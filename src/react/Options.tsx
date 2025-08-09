import { useUIStore } from './stores/uiStore';

export function Options() {
  const { audio, controls, graphics, toggleOptions } = useUIStore();

  return (
    <div className="fixed inset-0 z-50 grid place-items-center pointer-events-auto">
      <div className="w-[min(90vw,28rem)] rounded-xl bg-black/80 text-white p-6 shadow-xl backdrop-blur">
        <h2 className="text-lg font-semibold mb-4">Options</h2>

        <div className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">Audio</h3>
            <label className="block mb-2">
              <span className="mr-2">Master Volume: {audio.master}</span>
              <input
                className="w-full accent-neutral-400"
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={audio.master}
                onChange={(e) => useUIStore.setState({ audio: { ...audio, master: parseFloat(e.target.value) } })}
              />
            </label>
            <label className="block">
              <span className="mr-2">SFX Volume: {audio.sfx}</span>
              <input
                className="w-full accent-neutral-400"
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={audio.sfx}
                onChange={(e) => useUIStore.setState({ audio: { ...audio, sfx: parseFloat(e.target.value) } })}
              />
            </label>
          </div>

          <div>
            <h3 className="font-medium mb-2">Controls</h3>
            <label className="block mb-2">
              <span className="mr-2">Sensitivity: {controls.sensitivity}</span>
              <input
                className="w-full accent-neutral-400"
                type="range"
                min="0.1"
                max="5"
                step="0.1"
                value={controls.sensitivity}
                onChange={(e) => useUIStore.setState({ controls: { ...controls, sensitivity: parseFloat(e.target.value) } })}
              />
            </label>
            <label className="inline-flex items-center gap-2">
              <span>Invert Y: {controls.invertY ? 'On' : 'Off'}</span>
              <input
                className="accent-neutral-400"
                type="checkbox"
                checked={controls.invertY}
                onChange={(e) => useUIStore.setState({ controls: { ...controls, invertY: e.target.checked } })}
              />
            </label>
          </div>

          <div>
            <h3 className="font-medium mb-2">Graphics</h3>
            <label className="block">
              <span className="mr-2">Quality: {graphics.quality}</span>
              <select
                className="bg-neutral-900 rounded px-2 py-1"
                value={graphics.quality}
                onChange={(e) => useUIStore.setState({ graphics: { ...graphics, quality: e.target.value as 'low' | 'medium' | 'high' } })}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>

          <div className="pt-2 text-right">
            <button className="px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700" onClick={toggleOptions}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
