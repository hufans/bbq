// Agent-facing hint that this terminal renders inline images and which protocol to prefer.
// No in-repo consumer: image-capable agents read BBQ_IMAGE_PROTOCOL to pick an encoder.
// The previous name is not exported.
// The xterm image addon also renders Sixel (advertised via DA1) and iTerm2 IIP.
export const ORCA_IMAGE_PROTOCOL_ENV = 'BBQ_IMAGE_PROTOCOL'

// Kitty graphics: truecolor and no palette limit, the richest of the three the addon renders.
export const ORCA_IMAGE_PROTOCOL_VALUE = 'kitty'
