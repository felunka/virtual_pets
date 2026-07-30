import { Controller } from "@hotwired/stimulus"

const MEMBER_ANGULAR_SPEED = 0.000004
const POSITION_RESPONSE = 4.2
const MEMBER_RADIUS_WOBBLE = 1.2
const PET_RADIUS_WOBBLE = 0.7
const PET_ANGLE_SWAY = 0.07
const MIN_SCALE = 0.55
const MAX_SCALE = 2.4
const ZOOM_STEP = 0.16
const DRAG_THRESHOLD = 6
const PAN_SLACK_RATIO = 0.16
const PAN_SLACK_MIN = 70
const PAN_SLACK_MAX = 220

export default class extends Controller {
  static targets = [
    "lineLayer",
    "viewport",
    "panel",
    "panelTitle",
    "readonlyHint",
    "petForm",
    "methodField",
    "nameInput",
    "pictureInput",
    "moodInput",
    "moodOutput",
    "descriptionInput",
    "deleteForm",
    "saveButton",
    "zoomLabel"
  ]

  static values = {
    currentMemberId: Number
  }

  connect() {
    this.prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    this.nodes = this.collectNodes()
    this.links = this.collectLinks()
    this.selectedNode = null
    this.lastTimestamp = null
    this.pointerState = {
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
    this.preventClickUntil = 0

    this.updateSceneBounds()
    this.positionInitialNodes()
    this.configureOrbitMotion()
    this.buildLines()
    this.initializeViewTransform()
    this.applyViewTransform()
    this.bindEvents()

    if (!this.prefersReducedMotion) {
      this.animate = this.animate.bind(this)
      this.animationFrame = requestAnimationFrame((timestamp) => this.animate(timestamp))
    } else {
      this.renderNodes()
      this.renderLines()
    }
  }

  disconnect() {
    this.unbindEvents()
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame)
  }

  zoomIn() {
    const anchor = {
      x: this.sceneWidth / 2,
      y: this.sceneHeight / 2
    }
    this.setScaleAroundPoint(this.scale + ZOOM_STEP, anchor)
  }

  zoomOut() {
    const anchor = {
      x: this.sceneWidth / 2,
      y: this.sceneHeight / 2
    }
    this.setScaleAroundPoint(this.scale - ZOOM_STEP, anchor)
  }

  resetView() {
    this.scale = this.baseScale
    this.offsetX = this.baseOffsetX
    this.offsetY = this.baseOffsetY
    this.applyViewTransform()
  }

  closePanel() {
    this.panelTarget.hidden = true
    this.panelTarget.classList.remove("is-open")

    if (this.selectedNode) {
      this.selectedNode.element.classList.remove("is-selected")
      this.selectedNode = null
    }
  }

  syncMood(event) {
    this.moodOutputTarget.textContent = event.currentTarget.value
  }

  collectNodes() {
    return Array.from(this.element.querySelectorAll(".node")).map((element) => {
      const id = element.dataset.nodeId
      const kind = element.dataset.nodeKind || "center"

      return {
        id,
        kind,
        element,
        x: 0,
        y: 0,
        targetX: 0,
        targetY: 0,
        radius: this.resolveNodeRadius(element, kind)
      }
    })
  }

  resolveNodeRadius(element, kind) {
    const measuredRadius = element.offsetWidth > 0 ? element.offsetWidth / 2 : 0
    if (measuredRadius > 0) return measuredRadius

    if (kind === "center") return 95
    if (kind === "member") return 72
    return 64
  }

  collectLinks() {
    const links = []
    const members = this.nodes.filter((node) => node.kind === "member")

    members.forEach((memberNode) => {
      links.push({ from: "center", to: memberNode.id })

      const memberId = memberNode.element.dataset.memberId
      this.nodes
        .filter((node) => node.element.dataset.ownerId === memberId)
        .forEach((petNode) => {
          links.push({ from: memberNode.id, to: petNode.id })
        })
    })

    return links
  }

  updateSceneBounds() {
    const rect = this.element.getBoundingClientRect()
    this.sceneRect = rect
    this.sceneWidth = rect.width
    this.sceneHeight = rect.height
  }

  positionInitialNodes() {
    const center = this.findNode("center")
    const members = this.nodes.filter((node) => node.kind === "member")
    const pets = this.nodes.filter((node) => node.kind === "pet" || node.kind === "new-pet")
    const compact = this.sceneWidth < 980

    this.refreshNodeRadii()

    center.x = this.sceneWidth / 2
    center.y = this.sceneHeight / 2
    center.targetX = center.x
    center.targetY = center.y

    const maxMemberRadius = Math.max(...members.map((node) => node.radius), 52)
    const maxPetRadius = Math.max(...pets.map((node) => node.radius), 50)

    // Keep center/member relationship visually tighter, then scale viewport as needed.
    const minMemberDistance = center.radius + maxMemberRadius + (compact ? 26 : 38)
    const memberGap = maxMemberRadius * 2 + (compact ? 18 : 28)
    const memberRingByCount = members.length > 1
      ? memberGap / (2 * Math.sin(Math.PI / members.length))
      : minMemberDistance
    const memberRing = Math.max(minMemberDistance, memberRingByCount)

    const maxPetsPerMember = members.reduce((max, member) => {
      const count = this.nodes.filter((node) => node.element.dataset.ownerId === member.element.dataset.memberId).length
      return Math.max(max, count)
    }, 0)
    const basePetRing = maxMemberRadius + maxPetRadius + (compact ? 18 : 28)
    const minPetSpacing = 2 * maxPetRadius + (compact ? 8 : 12)
    const preferredStep = compact ? 0.84 : 0.74
    const requiredPetRing = maxPetsPerMember > 1
      ? minPetSpacing / (2 * Math.sin(preferredStep / 2))
      : basePetRing
    const petRing = Math.max(basePetRing, requiredPetRing)

    members.forEach((member, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(members.length, 1)

      member.x = center.x + Math.cos(angle) * memberRing
      member.y = center.y + Math.sin(angle) * memberRing
      member.targetX = member.x
      member.targetY = member.y

      const pets = this.nodes.filter((node) => node.element.dataset.ownerId === member.element.dataset.memberId)
      const outwardAngle = angle
      const spreadStep = this.petSpreadStep(petRing, maxPetRadius, compact)

      pets.forEach((pet, petIndex) => {
        const offset = (petIndex - (pets.length - 1) / 2) * spreadStep
        const petAngle = outwardAngle + offset

        pet.x = member.x + Math.cos(petAngle) * petRing
        pet.y = member.y + Math.sin(petAngle) * petRing
        pet.targetX = pet.x
        pet.targetY = pet.y
      })
    })

    this.renderNodes()
    this.updateContentBounds()
  }

  configureOrbitMotion() {
    const center = this.findNode("center")
    const members = this.nodes.filter((node) => node.kind === "member")

    members.forEach((member, index) => {
      const dx = member.x - center.x
      const dy = member.y - center.y

      member.motion = {
        baseAngle: Math.atan2(dy, dx),
        baseRadius: Math.sqrt(dx * dx + dy * dy),
        radialFrequency: 0.00005 + index * 0.000003,
        radialPhase: index * 0.9,
        wobblePhase: index * 0.5
      }

      const pets = this.nodes.filter((node) => node.element.dataset.ownerId === member.element.dataset.memberId)
      const outwardAngle = member.motion.baseAngle
      const compact = this.sceneWidth < 980
      const maxRadiusForGroup = Math.max(...pets.map((pet) => pet.radius), 50)
      const orbitRadius = this.distanceBetween(member, pets[0]) || (compact ? 120 : 150)
      const spreadStep = this.petSpreadStep(orbitRadius, maxRadiusForGroup, compact)

      pets.forEach((pet, petIndex) => {
        const offset = (petIndex - (pets.length - 1) / 2) * spreadStep

        pet.motion = {
          baseAngle: outwardAngle + offset,
          baseRadius: orbitRadius,
          angleFrequency: 0.00006 + petIndex * 0.000004,
          radialFrequency: 0.00007 + petIndex * 0.000004,
          phase: (index + 1) * (petIndex + 1) * 0.55
        }
      })
    })
  }

  bindEvents() {
    this.handleResize = this.handleResize.bind(this)
    this.handlePointerDown = this.handlePointerDown.bind(this)
    this.handlePointerMove = this.handlePointerMove.bind(this)
    this.handlePointerUp = this.handlePointerUp.bind(this)
    this.handleWheel = this.handleWheel.bind(this)
    this.handleSceneClickCapture = this.handleSceneClickCapture.bind(this)

    window.addEventListener("resize", this.handleResize)
    this.element.addEventListener("pointerdown", this.handlePointerDown)
    this.element.addEventListener("pointermove", this.handlePointerMove)
    this.element.addEventListener("pointerup", this.handlePointerUp)
    this.element.addEventListener("pointercancel", this.handlePointerUp)
    this.element.addEventListener("wheel", this.handleWheel, { passive: false })
    this.element.addEventListener("click", this.handleSceneClickCapture, true)

    this.nodes.forEach((node) => {
      if (node.kind === "pet" || node.kind === "new-pet") {
        node.element.addEventListener("click", () => this.openPetPanel(node))
      }
    })
  }

  unbindEvents() {
    window.removeEventListener("resize", this.handleResize)
    this.element.removeEventListener("pointerdown", this.handlePointerDown)
    this.element.removeEventListener("pointermove", this.handlePointerMove)
    this.element.removeEventListener("pointerup", this.handlePointerUp)
    this.element.removeEventListener("pointercancel", this.handlePointerUp)
    this.element.removeEventListener("wheel", this.handleWheel)
    this.element.removeEventListener("click", this.handleSceneClickCapture, true)
  }

  handleResize() {
    const previousCenter = {
      x: this.sceneWidth / 2,
      y: this.sceneHeight / 2
    }

    this.updateSceneBounds()
    this.positionInitialNodes()
    this.configureOrbitMotion()
    this.recalculateBaseViewTransform()
    this.recenterViewAfterResize(previousCenter)
    this.applyViewTransform()
    this.renderLines()
  }

  handlePointerDown(event) {
    if (event.target.closest(".pet-editor") || event.target.closest(".mind-map-controls")) return

    this.pointerState.active.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY
    })

    if (this.pointerState.active.size === 1) {
      this.pointerState.dragPointerId = event.pointerId
      this.pointerState.dragOrigin = { x: event.clientX, y: event.clientY }
      this.pointerState.viewOrigin = { x: this.offsetX, y: this.offsetY }
      this.pointerState.panning = false
      this.pointerState.gestureWasDrag = false
      this.pointerState.dragDistance = 0
      this.pointerState.startedOnNode = Boolean(event.target.closest(".node"))
    }

    if (this.pointerState.active.size === 2) {
      const [a, b] = Array.from(this.pointerState.active.values())
      this.pointerState.pinchDistance = this.distance(a, b)
      this.pointerState.pinchMidpoint = this.midpoint(a, b)
      this.pointerState.dragPointerId = null
      this.pointerState.panning = true
      this.pointerState.gestureWasDrag = true
    }
  }

  handlePointerMove(event) {
    if (!this.pointerState.active.has(event.pointerId)) return

    this.pointerState.active.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY
    })

    if (this.pointerState.active.size >= 2) {
      const [a, b] = Array.from(this.pointerState.active.values())
      const nextDistance = this.distance(a, b)
      const midpoint = this.midpoint(a, b)

      if (this.pointerState.pinchDistance && nextDistance > 0) {
        const scaleFactor = nextDistance / this.pointerState.pinchDistance
        this.setScaleAroundPoint(this.scale * scaleFactor, midpoint)
      }

      this.pointerState.pinchDistance = nextDistance
      this.pointerState.pinchMidpoint = midpoint
      this.pointerState.panning = true
      return
    }

    if (this.pointerState.dragPointerId !== event.pointerId || !this.pointerState.dragOrigin || !this.pointerState.viewOrigin) {
      return
    }

    const dx = event.clientX - this.pointerState.dragOrigin.x
    const dy = event.clientY - this.pointerState.dragOrigin.y
    const moved = Math.hypot(dx, dy)
    this.pointerState.dragDistance = Math.max(this.pointerState.dragDistance, moved)
    const dragThreshold = this.pointerState.startedOnNode ? DRAG_THRESHOLD * 2.5 : DRAG_THRESHOLD

    if (!this.pointerState.panning && moved > dragThreshold) {
      this.pointerState.panning = true
      this.pointerState.gestureWasDrag = true
      this.element.classList.add("is-panning")
    }

    if (!this.pointerState.panning) return

    this.offsetX = this.pointerState.viewOrigin.x + dx
    this.offsetY = this.pointerState.viewOrigin.y + dy
    this.clampOffsets()
    this.applyViewTransform()
  }

  handlePointerUp(event) {
    this.pointerState.active.delete(event.pointerId)

    if (this.pointerState.gestureWasDrag) {
      this.preventClickUntil = performance.now() + 120
    }

    if (this.pointerState.active.size < 2) {
      this.pointerState.pinchDistance = null
      this.pointerState.pinchMidpoint = null
    }

    if (this.pointerState.active.size === 1) {
      const [remainingId, point] = Array.from(this.pointerState.active.entries())[0]
      this.pointerState.dragPointerId = remainingId
      this.pointerState.dragOrigin = { x: point.x, y: point.y }
      this.pointerState.viewOrigin = { x: this.offsetX, y: this.offsetY }
      this.pointerState.panning = false
      this.pointerState.gestureWasDrag = false
      this.pointerState.dragDistance = 0
      this.pointerState.startedOnNode = false
    } else {
      this.pointerState.dragPointerId = null
      this.pointerState.dragOrigin = null
      this.pointerState.viewOrigin = null
      this.pointerState.panning = false
      this.pointerState.gestureWasDrag = false
      this.pointerState.dragDistance = 0
      this.pointerState.startedOnNode = false
      this.element.classList.remove("is-panning")
    }
  }

  handleWheel(event) {
    if (event.target.closest(".pet-editor") || event.target.closest(".mind-map-controls")) return

    event.preventDefault()
    const direction = event.deltaY < 0 ? 1 : -1
    const nextScale = this.scale + direction * ZOOM_STEP
    const anchor = {
      x: event.clientX - this.sceneRect.left,
      y: event.clientY - this.sceneRect.top
    }
    this.setScaleAroundPoint(nextScale, anchor)
  }

  handleSceneClickCapture(event) {
    if (performance.now() < this.preventClickUntil) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  buildLines() {
    this.lineTargetMap = new Map()

    this.links.forEach((link) => {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line")
      line.classList.add("mind-line")
      line.dataset.from = link.from
      line.dataset.to = link.to
      this.lineLayerTarget.appendChild(line)
      this.lineTargetMap.set(`${link.from}:${link.to}`, line)
    })

    this.renderLines()
  }

  animate(timestamp) {
    if (!this.lastTimestamp) this.lastTimestamp = timestamp

    const deltaSeconds = Math.min((timestamp - this.lastTimestamp) / 1000, 0.04)
    this.lastTimestamp = timestamp

    this.updateTargetPositions(timestamp)
    this.smoothlyApproachTargets(deltaSeconds)
    this.renderNodes()
    this.renderLines()

    this.animationFrame = requestAnimationFrame((nextTimestamp) => this.animate(nextTimestamp))
  }

  updateTargetPositions(timestamp) {
    const center = this.findNode("center")
    center.targetX = this.sceneWidth / 2
    center.targetY = this.sceneHeight / 2
    center.x = center.targetX
    center.y = center.targetY

    this.nodes
      .filter((node) => node.kind === "member")
      .forEach((member) => {
        const motion = member.motion
        if (!motion) return

        const angle = motion.baseAngle + timestamp * MEMBER_ANGULAR_SPEED
        const radiusOffset = Math.sin(timestamp * motion.radialFrequency + motion.radialPhase) * MEMBER_RADIUS_WOBBLE
        const radius = motion.baseRadius + radiusOffset
        const driftX = Math.sin(timestamp * 0.00022 + motion.wobblePhase) * 0.45
        const driftY = Math.cos(timestamp * 0.0002 + motion.wobblePhase) * 0.45

        member.targetX = center.x + Math.cos(angle) * radius + driftX
        member.targetY = center.y + Math.sin(angle) * radius + driftY
      })

    this.nodes
      .filter((node) => node.kind === "pet" || node.kind === "new-pet")
      .forEach((pet) => {
        const owner = this.findOwnerFor(pet)
        const motion = pet.motion
        if (!owner || !motion) return

        const angleOffset = Math.sin(timestamp * motion.angleFrequency + motion.phase) * PET_ANGLE_SWAY
        const radiusOffset = Math.sin(timestamp * motion.radialFrequency + motion.phase) * PET_RADIUS_WOBBLE
        const radius = motion.baseRadius + radiusOffset

        pet.targetX = owner.targetX + Math.cos(motion.baseAngle + angleOffset) * radius
        pet.targetY = owner.targetY + Math.sin(motion.baseAngle + angleOffset) * radius
      })
  }

  smoothlyApproachTargets(deltaSeconds) {
    const easing = 1 - Math.exp(-POSITION_RESPONSE * deltaSeconds)

    this.nodes.forEach((node) => {
      if (node.kind === "center") return
      node.x += (node.targetX - node.x) * easing
      node.y += (node.targetY - node.y) * easing
    })
  }

  renderNodes() {
    this.nodes.forEach((node) => {
      node.element.style.left = `${node.x}px`
      node.element.style.top = `${node.y}px`
    })
  }

  renderLines() {
    this.lineLayerTarget.setAttribute("viewBox", `0 0 ${this.sceneWidth} ${this.sceneHeight}`)

    this.links.forEach((link) => {
      const line = this.lineTargetMap.get(`${link.from}:${link.to}`)
      const from = this.findNode(link.from)
      const to = this.findNode(link.to)
      if (!line || !from || !to) return

      line.setAttribute("x1", from.x)
      line.setAttribute("y1", from.y)
      line.setAttribute("x2", to.x)
      line.setAttribute("y2", to.y)
    })
  }

  initializeViewTransform() {
    this.recalculateBaseViewTransform()
    this.scale = this.baseScale
    this.offsetX = this.baseOffsetX
    this.offsetY = this.baseOffsetY
    this.updateZoomLabel()
  }

  recalculateBaseViewTransform() {
    this.updateContentBounds()
    const bounds = this.contentBounds
    if (!bounds) {
      this.baseScale = 1
      this.baseOffsetX = 0
      this.baseOffsetY = 0
      return
    }

    const fitByWidth = this.sceneWidth / bounds.width
    const fitByHeight = this.sceneHeight / bounds.height
    this.baseScale = Math.min(1, fitByWidth, fitByHeight)

    this.baseOffsetX = -bounds.minX * this.baseScale + (this.sceneWidth - bounds.width * this.baseScale) / 2
    this.baseOffsetY = -bounds.minY * this.baseScale + (this.sceneHeight - bounds.height * this.baseScale) / 2
  }

  recenterViewAfterResize(previousCenter) {
    const anchor = {
      x: previousCenter.x,
      y: previousCenter.y
    }

    if (typeof this.scale !== "number") {
      this.scale = this.baseScale
      this.offsetX = this.baseOffsetX
      this.offsetY = this.baseOffsetY
      return
    }

    const focusPoint = {
      x: this.sceneWidth / 2,
      y: this.sceneHeight / 2
    }

    const worldX = (anchor.x - this.offsetX) / this.scale
    const worldY = (anchor.y - this.offsetY) / this.scale
    this.offsetX = focusPoint.x - worldX * this.scale
    this.offsetY = focusPoint.y - worldY * this.scale
    this.clampOffsets()
  }

  setScaleAroundPoint(nextScale, anchor) {
    const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, nextScale))
    const currentScale = this.scale || this.baseScale || 1
    const worldX = (anchor.x - this.offsetX) / currentScale
    const worldY = (anchor.y - this.offsetY) / currentScale

    this.scale = clampedScale
    this.offsetX = anchor.x - worldX * this.scale
    this.offsetY = anchor.y - worldY * this.scale
    this.clampOffsets()
    this.applyViewTransform()
  }

  clampOffsets() {
    this.updateContentBounds()
    const bounds = this.contentBounds
    if (!bounds) return

    const scaledWidth = bounds.width * this.scale
    const scaledHeight = bounds.height * this.scale

    const centerX = -bounds.minX * this.scale + (this.sceneWidth - scaledWidth) / 2
    const centerY = -bounds.minY * this.scale + (this.sceneHeight - scaledHeight) / 2
    const slack = this.panSlack()

    let minX
    let maxX
    if (scaledWidth <= this.sceneWidth) {
      minX = centerX - slack
      maxX = centerX + slack
    } else {
      minX = this.sceneWidth - bounds.maxX * this.scale - slack
      maxX = -bounds.minX * this.scale + slack
    }

    let minY
    let maxY
    if (scaledHeight <= this.sceneHeight) {
      minY = centerY - slack
      maxY = centerY + slack
    } else {
      minY = this.sceneHeight - bounds.maxY * this.scale - slack
      maxY = -bounds.minY * this.scale + slack
    }

    this.offsetX = Math.min(maxX, Math.max(minX, this.offsetX))
    this.offsetY = Math.min(maxY, Math.max(minY, this.offsetY))
  }

  applyViewTransform() {
    this.viewportTarget.style.transform = `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.scale})`
    this.updateZoomLabel()
  }

  updateZoomLabel() {
    if (!this.hasZoomLabelTarget) return
    this.zoomLabelTarget.textContent = `${Math.round(this.scale * 100)}%`
  }

  refreshNodeRadii() {
    this.nodes.forEach((node) => {
      node.radius = this.resolveNodeRadius(node.element, node.kind)
    })
  }

  updateContentBounds() {
    if (!this.nodes.length) {
      this.contentBounds = null
      return
    }

    const padding = 28
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    this.nodes.forEach((node) => {
      const left = node.x - node.radius
      const right = node.x + node.radius
      const top = node.y - node.radius
      const bottom = node.y + node.radius

      if (left < minX) minX = left
      if (right > maxX) maxX = right
      if (top < minY) minY = top
      if (bottom > maxY) maxY = bottom
    })

    this.contentBounds = {
      minX: minX - padding,
      minY: minY - padding,
      maxX: maxX + padding,
      maxY: maxY + padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2
    }
  }

  distanceBetween(a, b) {
    if (!a || !b) return 0
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  midpoint(a, b) {
    return {
      x: (a.x + b.x) / 2 - this.sceneRect.left,
      y: (a.y + b.y) / 2 - this.sceneRect.top
    }
  }

  petSpreadStep(radius, petRadius, compact) {
    const baseStep = compact ? 0.62 : 0.7
    const desiredSpacing = 2 * petRadius + (compact ? 8 : 12)
    const ratio = Math.min(0.99, desiredSpacing / Math.max(2 * radius, 1))
    const requiredStep = 2 * Math.asin(ratio)
    return Math.max(baseStep, Math.min(1.35, requiredStep + 0.03))
  }

  panSlack() {
    const minAxis = Math.min(this.sceneWidth, this.sceneHeight)
    return Math.max(PAN_SLACK_MIN, Math.min(PAN_SLACK_MAX, minAxis * PAN_SLACK_RATIO))
  }

  openPetPanel(node) {
    if (this.selectedNode) this.selectedNode.element.classList.remove("is-selected")

    this.selectedNode = node
    node.element.classList.add("is-selected")

    const isNew = node.kind === "new-pet"
    const editable = node.element.dataset.editable === "true"
    const petId = node.element.dataset.petId

    this.panelTitleTarget.textContent = isNew ? "Create pet" : node.element.dataset.petName || "Pet"
    this.nameInputTarget.value = isNew ? "" : node.element.dataset.petName || ""
    this.pictureInputTarget.value = node.element.dataset.petPicture || "🐣"
    this.moodInputTarget.value = node.element.dataset.petMood || "5"
    this.moodOutputTarget.textContent = this.moodInputTarget.value
    this.descriptionInputTarget.value = node.element.dataset.petDescription || ""

    const readOnly = !editable
    this.toggleEditorReadOnly(readOnly)

    if (isNew) {
      this.petFormTarget.action = "/pets"
      this.methodFieldTarget.value = "post"
      this.deleteFormTarget.hidden = true
    } else {
      this.petFormTarget.action = `/pets/${petId}`
      this.methodFieldTarget.value = "patch"
      this.deleteFormTarget.action = `/pets/${petId}`
      this.deleteFormTarget.hidden = readOnly
    }

    this.panelTarget.hidden = false
    this.panelTarget.classList.add("is-open")
  }

  toggleEditorReadOnly(readOnly) {
    this.readonlyHintTarget.hidden = !readOnly
    this.saveButtonTarget.hidden = readOnly

    this.nameInputTarget.readOnly = readOnly
    this.pictureInputTarget.readOnly = readOnly
    this.moodInputTarget.disabled = readOnly
    this.descriptionInputTarget.readOnly = readOnly
  }

  findNode(id) {
    return this.nodes.find((node) => node.id === id)
  }

  findOwnerFor(node) {
    const ownerId = node.element.dataset.ownerId
    return this.nodes.find((candidate) => candidate.kind === "member" && candidate.element.dataset.memberId === ownerId)
  }
}
