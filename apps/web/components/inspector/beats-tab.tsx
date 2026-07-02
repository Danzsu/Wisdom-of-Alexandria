"use client";

import { useInspectorScene } from "./use-inspector-scene";
import { SceneBeatsPanel } from "./scene-beats-panel";

/**
 * Beatek tab: the full scene-level beat editor (`SceneBeatsPanel`) bound to
 * the ACTIVE scene from the route. Listing, adding, editing, deleting and
 * drag-reordering all live in the panel — this wrapper only resolves the
 * scene id the same way the other inspector tabs do.
 */
export function BeatsTab() {
  const { sceneId } = useInspectorScene();
  return <SceneBeatsPanel sceneId={sceneId} />;
}
