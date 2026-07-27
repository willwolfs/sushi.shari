import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders pantalla de login del sistema', () => {
  render(<App />);
  const welcomeElement = screen.getByText(/BIENVENIDO/i);
  expect(welcomeElement).toBeDefined();
});
