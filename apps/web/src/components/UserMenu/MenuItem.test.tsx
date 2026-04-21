import { fireEvent, render, screen } from '@testing-library/react';
import MenuItem from './MenuItem';

describe('MenuItem', () => {
  it('renders the label', () => {
    render(
      <MenuItem icon="fa-bookmark" label="Your links" onClick={() => {}} />,
    );
    expect(screen.getByText('Your links')).toBeInTheDocument();
  });

  it('renders the icon with the given class', () => {
    const { container } = render(
      <MenuItem icon="fa-bookmark" label="Your links" onClick={() => {}} />,
    );
    const icon = container.querySelector('i');
    expect(icon).toHaveClass('fa-bookmark');
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(
      <MenuItem icon="fa-bookmark" label="Your links" onClick={onClick} />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('applies accent color to icon when active', () => {
    const { container } = render(
      <MenuItem
        icon="fa-bookmark"
        label="Your links"
        onClick={() => {}}
        active
      />,
    );
    const icon = container.querySelector('i');
    expect(icon?.className).toContain('text-[var(--accent)]');
  });

  it('applies muted color to icon when not active', () => {
    const { container } = render(
      <MenuItem icon="fa-bookmark" label="Your links" onClick={() => {}} />,
    );
    const icon = container.querySelector('i');
    expect(icon?.className).toContain('text-[var(--text-muted)]');
  });

  it('forwards extra className to the button', () => {
    render(
      <MenuItem
        icon="fa-bookmark"
        label="Your links"
        onClick={() => {}}
        className="border-t"
      />,
    );
    expect(screen.getByRole('button')).toHaveClass('border-t');
  });
});
