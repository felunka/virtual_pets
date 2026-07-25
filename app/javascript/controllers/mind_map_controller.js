import { Controller } from "@hotwired/stimulus"

const MEMBER_ANGULAR_SPEED = 0.000004
const POSITION_RESPONSE = 4.2
const MEMBER_RADIUS_WOBBLE = 1.2
const PET_RADIUS_WOBBLE = 0.7
const PET_ANGLE_SWAY = 0.07

export default class extends Controller {
  static targets = [
    "lineLayer",
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
    "saveButton"
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

    this.updateSceneBounds()
    this.positionInitialNodes()
    this.configureOrbitMotion()
    this.buildLines()
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
        radius: kind === "center" ? 95 : 72
      }
    })
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
    this.sceneWidth = rect.width
    this.sceneHeight = rect.height
  }

  positionInitialNodes() {
    const center = this.findNode("center")
    const members = this.nodes.filter((node) => node.kind === "member")

    center.x = this.sceneWidth / 2
    center.y = this.sceneHeight / 2
    center.targetX = center.x
    center.targetY = center.y

    const minMemberDistance = center.radius + 145
    const maxMemberDistance = Math.min(this.sceneWidth, this.sceneHeight) * 0.31
    const requiredForSpacing = ((members.length * 160) / (2 * Math.PI))
    const memberRing = Math.max(minMemberDistance, Math.min(maxMemberDistance, requiredForSpacing + 18))

    members.forEach((member, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(members.length, 1)

      member.x = center.x + Math.cos(angle) * memberRing
      member.y = center.y + Math.sin(angle) * memberRing
      member.targetX = member.x
      member.targetY = member.y

      const pets = this.nodes.filter((node) => node.element.dataset.ownerId === member.element.dataset.memberId)
      const outwardAngle = angle
      const spreadStep = 0.7
      const petRing = 150

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

      pets.forEach((pet, petIndex) => {
        const offset = (petIndex - (pets.length - 1) / 2) * 0.7

        pet.motion = {
          baseAngle: outwardAngle + offset,
          baseRadius: 150,
          angleFrequency: 0.00006 + petIndex * 0.000004,
          radialFrequency: 0.00007 + petIndex * 0.000004,
          phase: (index + 1) * (petIndex + 1) * 0.55
        }
      })
    })
  }

  bindEvents() {
    this.handleResize = this.handleResize.bind(this)
    window.addEventListener("resize", this.handleResize)

    this.nodes.forEach((node) => {
      if (node.kind === "pet" || node.kind === "new-pet") {
        node.element.addEventListener("click", () => this.openPetPanel(node))
      }
    })
  }

  unbindEvents() {
    window.removeEventListener("resize", this.handleResize)
  }

  handleResize() {
    this.updateSceneBounds()
    this.positionInitialNodes()
    this.configureOrbitMotion()
    this.renderLines()
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
