# Nocturne Creator Studio

## Open and save

Run the local Vite development server and open `http://localhost:5173/?creator=1`. Creator Studio is available only in the local development build. The public production build loads the approved scene configuration and removes the editor panel. Preview Mode closes the panel; use **Exit Preview** in the header to return.

Edits are saved automatically in this browser. **Save Scene** creates a manual checkpoint; **Load Scene** restores it. Named presets can be saved, loaded, and duplicated in the same browser. **Set as Default** downloads a complete JSON scene file. To publish an approved design, replace `Public/Assets/Config/scene-config.default.json` with that exported file, commit it, and deploy through the normal review workflow. Browser storage does not update the public website.

The existing Particle Settings panel contains GPU particle composition, appearance, and physics controls. Sphere dragging and its particle influence are enabled while **Spheres** is expanded. The selected sphere has position, depth, scale, and Y rotation controls. The bottle can be dragged with mouse or touch and continues moving with adjustable inertia and damping. Material, lighting, atmosphere, and camera values update the live scene and are included in the scene JSON.

## Current limits

This is a functional core editor. Localized brush painting, per-sphere material overrides, sphere add/duplicate/delete/locking, individual responsive composition presets, 3D light handles, shadow and bloom controls, and full vertical bottle rotation are not implemented. The panel does not show inert controls for these features. Browser presets stay on one device unless exported as JSON. Only white and gold sphere designs are currently instanced in the hero; the other source meshes remain in the asset library.
