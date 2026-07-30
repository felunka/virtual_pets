import {
  MIN_SCALE,
  MAX_SCALE,
  ZOOM_STEP,
  PAN_SLACK_RATIO,
  PAN_SLACK_MIN,
  PAN_SLACK_MAX
} from "controllers/mind_map/constants"

export class ViewTransform {
  constructor({ scene, viewportElement, zoomLabelElement }) {
    this.scene = scene
    this.viewportElement = viewportElement
    this.zoomLabelElement = zoomLabelElement

    this.baseScale = 1
    this.baseOffsetX = 0
    this.baseOffsetY = 0
    this.scale = 1
    this.offsetX = 0
    this.offsetY = 0
  }

  initialize() {
    this.recalculateBase()
    this.scale = this.baseScale
    this.offsetX = this.baseOffsetX
    this.offsetY = this.baseOffsetY
    this.updateZoomLabel()
  }

  zoomIn() {
    this.setScaleAroundPoint(this.scale + ZOOM_STEP, {
      x: this.scene.sceneWidth / 2,
      y: this.scene.sceneHeight / 2
    })
  }

  zoomOut() {
    this.setScaleAroundPoint(this.scale - ZOOM_STEP, {
      x: this.scene.sceneWidth / 2,
      y: this.scene.sceneHeight / 2
    })
  }

  reset() {
    this.scale = this.baseScale
    this.offsetX = this.baseOffsetX
    this.offsetY = this.baseOffsetY
    this.apply()
  }

  recalculateBase() {
    this.scene.updateContentBounds()
    const bounds = this.scene.contentBounds
    if (!bounds) {
      this.baseScale = 1
      this.baseOffsetX = 0
      this.baseOffsetY = 0
      return
    }

    const fitByWidth = this.scene.sceneWidth / bounds.width
    const fitByHeight = this.scene.sceneHeight / bounds.height
    this.baseScale = Math.min(1, fitByWidth, fitByHeight)

    this.baseOffsetX = -bounds.minX * this.baseScale + (this.scene.sceneWidth - bounds.width * this.baseScale) / 2
    this.baseOffsetY = -bounds.minY * this.baseScale + (this.scene.sceneHeight - bounds.height * this.baseScale) / 2
  }

  recenterAfterResize(previousCenter) {
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
      x: this.scene.sceneWidth / 2,
      y: this.scene.sceneHeight / 2
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
    this.apply()
  }

  setOffsets(offsetX, offsetY) {
    this.offsetX = offsetX
    this.offsetY = offsetY
    this.clampOffsets()
    this.apply()
  }

  clampOffsets() {
    this.scene.updateContentBounds()
    const bounds = this.scene.contentBounds
    if (!bounds) return

    const scaledWidth = bounds.width * this.scale
    const scaledHeight = bounds.height * this.scale

    const centerX = -bounds.minX * this.scale + (this.scene.sceneWidth - scaledWidth) / 2
    const centerY = -bounds.minY * this.scale + (this.scene.sceneHeight - scaledHeight) / 2
    const slack = this.panSlack()

    let minX
    let maxX
    if (scaledWidth <= this.scene.sceneWidth) {
      minX = centerX - slack
      maxX = centerX + slack
    } else {
      minX = this.scene.sceneWidth - bounds.maxX * this.scale - slack
      maxX = -bounds.minX * this.scale + slack
    }

    let minY
    let maxY
    if (scaledHeight <= this.scene.sceneHeight) {
      minY = centerY - slack
      maxY = centerY + slack
    } else {
      minY = this.scene.sceneHeight - bounds.maxY * this.scale - slack
      maxY = -bounds.minY * this.scale + slack
    }

    this.offsetX = Math.min(maxX, Math.max(minX, this.offsetX))
    this.offsetY = Math.min(maxY, Math.max(minY, this.offsetY))
  }

  panSlack() {
    const minAxis = Math.min(this.scene.sceneWidth, this.scene.sceneHeight)
    return Math.max(PAN_SLACK_MIN, Math.min(PAN_SLACK_MAX, minAxis * PAN_SLACK_RATIO))
  }

  apply() {
    this.viewportElement.style.transform = `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.scale})`
    this.updateZoomLabel()
  }

  updateZoomLabel() {
    if (!this.zoomLabelElement) return
    this.zoomLabelElement.textContent = `${Math.round(this.scale * 100)}%`
  }
}
