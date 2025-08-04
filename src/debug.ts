// Simple debug test to isolate the issue
import * as THREE from 'three';
import { EntityManager } from './core/EntityManager.js';

console.log('Debug script starting...');

// Test 1: Basic Three.js
try {
  console.log('Testing Three.js import...');
  console.log('Three.js imported successfully');
  
  // Test 2: Canvas access
  const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Canvas not found!');
  } else {
    console.log('Canvas found:', canvas);
  }
  
  // Test 3: Basic scene creation
  const scene = new THREE.Scene();
  console.log('Scene created successfully:', scene);
  
  // Test 4: ECS imports
  console.log('Testing ECS imports...');
  const entityManager = new EntityManager();
  console.log('EntityManager created successfully:', entityManager);
  
  // Test 5: Create a simple entity
  const testEntity = entityManager.createEntity();
  console.log('Test entity created:', testEntity);
  
} catch (error) {
  console.error('Debug test failed:', error);
}