import { emojiHintForPlatform } from "controllers/mind_map/platform"

export class PetPanel {
  constructor(targets) {
    this.targets = targets
    this.selectedNode = null
  }

  close() {
    this.targets.panel.hidden = true
    this.targets.panel.classList.remove("is-open")

    if (this.selectedNode) {
      this.selectedNode.element.classList.remove("is-selected")
      this.selectedNode = null
    }
  }

  syncMood(value) {
    this.targets.moodOutput.textContent = value
  }

  open(node) {
    if (this.selectedNode) this.selectedNode.element.classList.remove("is-selected")

    this.selectedNode = node
    node.element.classList.add("is-selected")

    const isNew = node.kind === "new-pet"
    const editable = String(node.element.dataset.editable).trim().toLowerCase() === "true"
    const petId = node.element.dataset.petId

    this.targets.panelTitle.textContent = isNew ? "Create pet" : node.element.dataset.petName || "Pet"
    this.targets.nameInput.value = isNew ? "" : node.element.dataset.petName || ""
    this.targets.pictureInput.value = isNew ? "" : node.element.dataset.petPicture || "🐣"
    this.targets.moodInput.value = node.element.dataset.petMood || "5"
    this.targets.moodOutput.textContent = this.targets.moodInput.value
    this.targets.descriptionInput.value = node.element.dataset.petDescription || ""
    this.updateEmojiHint()

    const readOnly = !editable
    this.toggleEditorReadOnly(readOnly)

    if (isNew) {
      this.targets.petForm.action = "/pets"
      this.targets.methodField.value = "post"
      this.targets.deleteForm.hidden = true
    } else {
      this.targets.petForm.action = `/pets/${petId}`
      this.targets.methodField.value = "patch"
      this.targets.deleteForm.action = `/pets/${petId}`
      this.targets.deleteForm.hidden = !editable
    }

    this.targets.panel.hidden = false
    this.targets.panel.classList.add("is-open")
  }

  syncNodeName(value) {
    if (!this.selectedNode) return

    const name = value
    const fallback = this.selectedNode.kind === "new-pet" ? "Add pet" : "Pet"
    const visibleName = name.length > 0 ? name : fallback

    this.selectedNode.element.dataset.petName = name
    const nameElement = this.selectedNode.element.querySelector(".pet-name")
    if (nameElement) nameElement.textContent = visibleName

    this.targets.panelTitle.textContent = this.selectedNode.kind === "new-pet" ? "Create pet" : visibleName
  }

  syncNodePicture(value) {
    if (!this.selectedNode) return

    const picture = value
    const fallback = this.selectedNode.kind === "new-pet" ? "➕" : "🐣"
    const visiblePicture = picture.length > 0 ? picture : fallback

    this.selectedNode.element.dataset.petPicture = picture
    const pictureElement = this.selectedNode.element.querySelector(".pet-emoji")
    if (pictureElement) pictureElement.textContent = visiblePicture
  }

  syncNodeMood(value) {
    if (!this.selectedNode) return

    const mood = Number.parseInt(value, 10)
    if (!Number.isFinite(mood)) return

    const normalizedMood = Math.max(0, Math.min(10, mood))

    this.selectedNode.element.dataset.petMood = String(normalizedMood)

    if (this.selectedNode.kind !== "pet") return

    this.selectedNode.element.style.setProperty("--mood-percent", `${normalizedMood * 10}%`)
    this.selectedNode.element.style.setProperty("--mood-hue", `${normalizedMood * 12}`)
  }

  toggleEditorReadOnly(readOnly) {
    this.targets.readonlyHint.hidden = !readOnly
    this.targets.saveButton.hidden = readOnly

    this.targets.nameInput.readOnly = readOnly
    this.targets.pictureInput.readOnly = readOnly
    this.targets.moodInput.disabled = readOnly
    this.targets.descriptionInput.readOnly = readOnly
  }

  updateEmojiHint() {
    if (!this.targets.emojiHint) return

    const hint = emojiHintForPlatform()
    this.targets.emojiHint.textContent = hint
    this.targets.emojiHint.hidden = hint.length === 0
  }
}
