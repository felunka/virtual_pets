import {
  POSITION_RESPONSE,
  MEMBER_RADIUS_WOBBLE,
  PET_RADIUS_WOBBLE,
  PET_ANGLE_SWAY
} from "controllers/mind_map/constants"

export class MindMapScene {
  constructor({ rootElement, lineLayerElement }) {
    this.rootElement = rootElement
    this.lineLayerElement = lineLayerElement
    this.nodes = this.collectNodes()
    this.links = this.collectLinks()
    this.lineTargetMap = new Map()
    this.lastTimestamp = null

    this.updateSceneBounds()
  }

  updateSceneBounds() {
    const rect = this.rootElement.getBoundingClientRect()
    this.sceneRect = rect
    this.sceneWidth = rect.width
    this.sceneHeight = rect.height
  }

  collectNodes() {
    return Array.from(this.rootElement.querySelectorAll(".node")).map((element) => {
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

  positionInitialNodes() {
    const center = this.findNode("center")
    if (!center) return

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

      const ownedPets = this.nodes.filter((node) => node.element.dataset.ownerId === member.element.dataset.memberId)
      const outwardAngle = angle
      const spreadStep = this.petSpreadStep(petRing, maxPetRadius, compact)

      ownedPets.forEach((pet, petIndex) => {
        const offset = (petIndex - (ownedPets.length - 1) / 2) * spreadStep
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
    if (!center) return

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

  buildLines() {
    this.lineTargetMap = new Map()

    this.links.forEach((link) => {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line")
      line.classList.add("mind-line")
      line.dataset.from = link.from
      line.dataset.to = link.to
      this.lineLayerElement.appendChild(line)
      this.lineTargetMap.set(`${link.from}:${link.to}`, line)
    })

    this.renderLines()
  }

  step(timestamp) {
    if (!this.lastTimestamp) this.lastTimestamp = timestamp

    const deltaSeconds = Math.min((timestamp - this.lastTimestamp) / 1000, 0.04)
    this.lastTimestamp = timestamp

    this.updateTargetPositions(timestamp)
    this.smoothlyApproachTargets(deltaSeconds)
    this.renderNodes()
    this.renderLines()
  }

  renderStatic() {
    this.renderNodes()
    this.renderLines()
  }

  updateTargetPositions(timestamp) {
    const center = this.findNode("center")
    if (!center) return

    center.targetX = this.sceneWidth / 2
    center.targetY = this.sceneHeight / 2
    center.x = center.targetX
    center.y = center.targetY

    this.nodes
      .filter((node) => node.kind === "member")
      .forEach((member) => {
        const motion = member.motion
        if (!motion) return

        const angle = motion.baseAngle
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
    this.lineLayerElement.setAttribute("viewBox", `0 0 ${this.sceneWidth} ${this.sceneHeight}`)

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

  petSpreadStep(radius, petRadius, compact) {
    const baseStep = compact ? 0.62 : 0.7
    const desiredSpacing = 2 * petRadius + (compact ? 8 : 12)
    const ratio = Math.min(0.99, desiredSpacing / Math.max(2 * radius, 1))
    const requiredStep = 2 * Math.asin(ratio)
    return Math.max(baseStep, Math.min(1.35, requiredStep + 0.03))
  }

  findNode(id) {
    return this.nodes.find((node) => node.id === id)
  }

  findOwnerFor(node) {
    const ownerId = node.element.dataset.ownerId
    return this.nodes.find((candidate) => candidate.kind === "member" && candidate.element.dataset.memberId === ownerId)
  }
}
