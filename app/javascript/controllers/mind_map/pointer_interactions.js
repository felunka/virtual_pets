import { DRAG_THRESHOLD, ZOOM_STEP } from "controllers/mind_map/constants"

export class PointerInteractions {
  constructor({ sceneElement, scene, view }) {
    this.sceneElement = sceneElement
    this.scene = scene
    this.view = view
    this.preventClickUntil = 0

    this.state = {
      active: new Map(),
      dragPointerId: null,
      dragOrigin: null,
      viewOrigin: null,
      pinchDistance: null,
      pinchMidpoint: null,
      panning: false,
      gestureWasDrag: false,
      startedOnNode: false,
      dragDistance: 0
    }
  }

  bind() {
    this.handlePointerDown = this.handlePointerDown.bind(this)
    this.handlePointerMove = this.handlePointerMove.bind(this)
    this.handlePointerUp = this.handlePointerUp.bind(this)
    this.handleWheel = this.handleWheel.bind(this)
    this.handleSceneClickCapture = this.handleSceneClickCapture.bind(this)

    this.sceneElement.addEventListener("pointerdown", this.handlePointerDown)
    this.sceneElement.addEventListener("pointermove", this.handlePointerMove)
    this.sceneElement.addEventListener("pointerup", this.handlePointerUp)
    this.sceneElement.addEventListener("pointercancel", this.handlePointerUp)
    this.sceneElement.addEventListener("wheel", this.handleWheel, { passive: false })
    this.sceneElement.addEventListener("click", this.handleSceneClickCapture, true)
  }

  unbind() {
    this.sceneElement.removeEventListener("pointerdown", this.handlePointerDown)
    this.sceneElement.removeEventListener("pointermove", this.handlePointerMove)
    this.sceneElement.removeEventListener("pointerup", this.handlePointerUp)
    this.sceneElement.removeEventListener("pointercancel", this.handlePointerUp)
    this.sceneElement.removeEventListener("wheel", this.handleWheel)
    this.sceneElement.removeEventListener("click", this.handleSceneClickCapture, true)
  }

  handlePointerDown(event) {
    if (event.target.closest(".pet-editor") || event.target.closest(".mind-map-controls")) return

    this.state.active.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY
    })

    if (this.state.active.size === 1) {
      this.state.dragPointerId = event.pointerId
      this.state.dragOrigin = { x: event.clientX, y: event.clientY }
      this.state.viewOrigin = { x: this.view.offsetX, y: this.view.offsetY }
      this.state.panning = false
      this.state.gestureWasDrag = false
      this.state.dragDistance = 0
      this.state.startedOnNode = Boolean(event.target.closest(".node"))
    }

    if (this.state.active.size === 2) {
      const [a, b] = Array.from(this.state.active.values())
      this.state.pinchDistance = this.distance(a, b)
      this.state.pinchMidpoint = this.midpoint(a, b)
      this.state.dragPointerId = null
      this.state.panning = true
      this.state.gestureWasDrag = true
    }
  }

  handlePointerMove(event) {
    if (!this.state.active.has(event.pointerId)) return

    this.state.active.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY
    })

    if (this.state.active.size >= 2) {
      const [a, b] = Array.from(this.state.active.values())
      const nextDistance = this.distance(a, b)
      const midpoint = this.midpoint(a, b)

      if (this.state.pinchDistance && nextDistance > 0) {
        const scaleFactor = nextDistance / this.state.pinchDistance
        this.view.setScaleAroundPoint(this.view.scale * scaleFactor, midpoint)
      }

      this.state.pinchDistance = nextDistance
      this.state.pinchMidpoint = midpoint
      this.state.panning = true
      return
    }

    if (this.state.dragPointerId !== event.pointerId || !this.state.dragOrigin || !this.state.viewOrigin) {
      return
    }

    const dx = event.clientX - this.state.dragOrigin.x
    const dy = event.clientY - this.state.dragOrigin.y
    const moved = Math.hypot(dx, dy)
    this.state.dragDistance = Math.max(this.state.dragDistance, moved)
    const dragThreshold = this.state.startedOnNode ? DRAG_THRESHOLD * 2.5 : DRAG_THRESHOLD

    if (!this.state.panning && moved > dragThreshold) {
      this.state.panning = true
      this.state.gestureWasDrag = true
      this.sceneElement.classList.add("is-panning")
    }

    if (!this.state.panning) return

    this.view.setOffsets(this.state.viewOrigin.x + dx, this.state.viewOrigin.y + dy)
  }

  handlePointerUp(event) {
    this.state.active.delete(event.pointerId)

    if (this.state.gestureWasDrag) {
      this.preventClickUntil = performance.now() + 120
    }

    if (this.state.active.size < 2) {
      this.state.pinchDistance = null
      this.state.pinchMidpoint = null
    }

    if (this.state.active.size === 1) {
      const [remainingId, point] = Array.from(this.state.active.entries())[0]
      this.state.dragPointerId = remainingId
      this.state.dragOrigin = { x: point.x, y: point.y }
      this.state.viewOrigin = { x: this.view.offsetX, y: this.view.offsetY }
      this.state.panning = false
      this.state.gestureWasDrag = false
      this.state.dragDistance = 0
      this.state.startedOnNode = false
    } else {
      this.state.dragPointerId = null
      this.state.dragOrigin = null
      this.state.viewOrigin = null
      this.state.panning = false
      this.state.gestureWasDrag = false
      this.state.dragDistance = 0
      this.state.startedOnNode = false
      this.sceneElement.classList.remove("is-panning")
    }
  }

  handleWheel(event) {
    if (event.target.closest(".pet-editor") || event.target.closest(".mind-map-controls")) return

    event.preventDefault()
    const direction = event.deltaY < 0 ? 1 : -1
    const nextScale = this.view.scale + direction * ZOOM_STEP
    const anchor = {
      x: event.clientX - this.scene.sceneRect.left,
      y: event.clientY - this.scene.sceneRect.top
    }

    this.view.setScaleAroundPoint(nextScale, anchor)
  }

  handleSceneClickCapture(event) {
    if (performance.now() < this.preventClickUntil) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  midpoint(a, b) {
    return {
      x: (a.x + b.x) / 2 - this.scene.sceneRect.left,
      y: (a.y + b.y) / 2 - this.scene.sceneRect.top
    }
  }
}
