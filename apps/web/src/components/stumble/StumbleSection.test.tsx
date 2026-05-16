import StumbleSection from './StumbleSection';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('StumbleSection', () => {
  it('renders the section heading', () => {
    render(<StumbleSection />);
    expect(
      screen.getByRole('heading', { name: /stumble!/i }),
    ).toBeInTheDocument();
  });

  it('renders the draggable bookmark link pointing to /stumble', () => {
    render(<StumbleSection />);
    const link = screen.getByRole('link', { name: /stumble!/i });
    expect(link).toHaveAttribute('href', '/stumble');
    expect(link).toHaveAttribute('draggable', 'true');
  });
});
