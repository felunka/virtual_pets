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
    const editable = node.element.dataset.editable === "true"
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
      this.targets.deleteForm.hidden = readOnly
    }

    this.targets.panel.hidden = false
    this.targets.panel.classList.add("is-open")
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
