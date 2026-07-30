import { Controller } from "@hotwired/stimulus"
import { MindMapScene } from "controllers/mind_map/scene"
import { ViewTransform } from "controllers/mind_map/view_transform"
import { PointerInteractions } from "controllers/mind_map/pointer_interactions"
import { PetPanel } from "controllers/mind_map/pet_panel"

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
    "emojiHint",
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
    this.scene = new MindMapScene({
      rootElement: this.element,
      lineLayerElement: this.lineLayerTarget
    })
    this.scene.positionInitialNodes()
    this.scene.configureOrbitMotion()
    this.scene.buildLines()

    this.view = new ViewTransform({
      scene: this.scene,
      viewportElement: this.viewportTarget,
      zoomLabelElement: this.hasZoomLabelTarget ? this.zoomLabelTarget : null
    })
    this.view.initialize()
    this.view.apply()

    this.panel = new PetPanel({
      panel: this.panelTarget,
      panelTitle: this.panelTitleTarget,
      readonlyHint: this.readonlyHintTarget,
      petForm: this.petFormTarget,
      methodField: this.methodFieldTarget,
      nameInput: this.nameInputTarget,
      pictureInput: this.pictureInputTarget,
      emojiHint: this.hasEmojiHintTarget ? this.emojiHintTarget : null,
      moodInput: this.moodInputTarget,
      moodOutput: this.moodOutputTarget,
      descriptionInput: this.descriptionInputTarget,
      deleteForm: this.deleteFormTarget,
      saveButton: this.saveButtonTarget
    })

    this.pointerInteractions = new PointerInteractions({
      sceneElement: this.element,
      scene: this.scene,
      view: this.view
    })
    this.pointerInteractions.bind()
    this.bindNodeClicks()
    this.bindResize()

    if (!this.prefersReducedMotion) {
      this.animate = this.animate.bind(this)
      this.animationFrame = requestAnimationFrame((timestamp) => this.animate(timestamp))
    } else {
      this.scene.renderStatic()
    }
  }

  disconnect() {
    this.unbindResize()
    this.unbindNodeClicks()
    this.pointerInteractions?.unbind()
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame)
  }

  zoomIn() {
    this.view.zoomIn()
  }

  zoomOut() {
    this.view.zoomOut()
  }

  resetView() {
    this.view.reset()
  }

  closePanel() {
    this.panel.close()
  }

  syncMood(event) {
    this.panel.syncMood(event.currentTarget.value)
  }

  bindResize() {
    this.handleResize = this.handleResize.bind(this)
    window.addEventListener("resize", this.handleResize)
  }

  unbindResize() {
    window.removeEventListener("resize", this.handleResize)
  }

  handleResize() {
    const previousCenter = {
      x: this.scene.sceneWidth / 2,
      y: this.scene.sceneHeight / 2
    }

    this.scene.updateSceneBounds()
    this.scene.positionInitialNodes()
    this.scene.configureOrbitMotion()
    this.view.recalculateBase()
    this.view.recenterAfterResize(previousCenter)
    this.view.apply()
    this.scene.renderLines()
  }

  animate(timestamp) {
    this.scene.step(timestamp)
    this.animationFrame = requestAnimationFrame((nextTimestamp) => this.animate(nextTimestamp))
  }

  bindNodeClicks() {
    this.nodeClickHandlers = []

    this.scene.nodes.forEach((node) => {
      if (node.kind !== "pet" && node.kind !== "new-pet") return

      const handler = () => this.panel.open(node)
      node.element.addEventListener("click", handler)
      this.nodeClickHandlers.push({ node, handler })
    })
  }

  unbindNodeClicks() {
    if (!this.nodeClickHandlers) return

    this.nodeClickHandlers.forEach(({ node, handler }) => {
      node.element.removeEventListener("click", handler)
    })

    this.nodeClickHandlers = []
  }
}
