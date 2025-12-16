type ARCState = {
  decided: boolean
}

const state: ARCState = {
  decided: false,
}

export function isDecided() {
  return state.decided
}

export function commitDecision() {
  state.decided = true
}
