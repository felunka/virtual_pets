export function detectPlatformKind() {
  const platform = (navigator.userAgentData?.platform || navigator.platform || "").toLowerCase()
  const userAgent = (navigator.userAgent || "").toLowerCase()
  const fingerprint = `${platform} ${userAgent}`

  if (/android|iphone|ipad|ipod|ios/.test(fingerprint)) return "mobile"
  if (/win/.test(fingerprint)) return "win"
  if (/mac|macintosh|mac os/.test(fingerprint)) return "mac"
  return "unknown"
}

export function emojiHintForPlatform() {
  const platformKind = detectPlatformKind()

  if (platformKind === "win") {
    return "Hint: open emoji keyboard with WIN+."
  }

  if (platformKind === "mac") {
    return "Hint: open emoji keyboard with Fn+E."
  }

  return ""
}
