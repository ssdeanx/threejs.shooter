import React from 'react';
import { useUIStore } from './stores/uiStore';

export function Options() {
  const { audio, controls, graphics, toggleOptions } = useUIStore();

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '20px',
      borderRadius: '10px',
      textAlign: 'center',
    }}>
      <h2>Options</h2>
      <div>
        <h3>Audio</h3>
        <label>
          Master Volume: {audio.master}
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={audio.master}
            onChange={(e) => useUIStore.setState({ audio: { ...audio, master: parseFloat(e.target.value) } })}
          />
        </label>
        <label>
          SFX Volume: {audio.sfx}
          <input
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
        <h3>Controls</h3>
        <label>
          Sensitivity: {controls.sensitivity}
          <input
            type="range"
            min="0.1"
            max="5"
            step="0.1"
            value={controls.sensitivity}
            onChange={(e) => useUIStore.setState({ controls: { ...controls, sensitivity: parseFloat(e.target.value) } })}
          />
        </label>
        <label>
          Invert Y: {controls.invertY ? 'On' : 'Off'}
          <input
            type="checkbox"
            checked={controls.invertY}
            onChange={(e) => useUIStore.setState({ controls: { ...controls, invertY: e.target.checked } })}
          />
        </label>
      </div>
      <div>
        <h3>Graphics</h3>
        <label>
          Quality: {graphics.quality}
          <select
            value={graphics.quality}
            onChange={(e) => useUIStore.setState({ graphics: { ...graphics, quality: e.target.value as 'low' | 'medium' | 'high' } })}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
      </div>
      <button onClick={toggleOptions}>Close</button>
    </div>
  );
}
