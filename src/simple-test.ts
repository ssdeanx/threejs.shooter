console.log('Simple test starting...');

// Test if DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM is ready');
  
  const canvas = document.getElementById('gameCanvas');
  console.log('Canvas element:', canvas);
  
  if (canvas) {
    console.log('Canvas found successfully');
    canvas.style.backgroundColor = 'red'; // Visual test
  } else {
    console.error('Canvas not found!');
  }
});

// Also test immediate execution
console.log('Document ready state:', document.readyState);
const canvas = document.getElementById('gameCanvas');
console.log('Canvas (immediate):', canvas);