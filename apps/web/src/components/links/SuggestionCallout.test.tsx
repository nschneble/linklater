import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SuggestionCallout from './SuggestionCallout';
import * as api from '../../lib/api';

vi.mock('../../theme/ThemeContext', () => ({
  useTheme: () => ({ baseTheme: 'scanner-darkly' }),
  useThemeStyling: () => ({ baseTheme: 'scanner-darkly', mode: 'dark' }),
}));

vi.mock('../../lib/api', () => ({
  getSuggestions: vi.fn(),
  createLink: vi.fn(),
  readLink: vi.fn(),
}));

function makeSuggestion(
  overrides: Partial<api.Suggestion> = {},
): api.Suggestion {
  return {
    url: 'https://example.com/featured',
    title: 'A featured article',
    description: 'A short snippet describing the article.',
    imageUrl: null,
    siteName: 'Aeon',
    ...overrides,
  };
}

describe('SuggestionCallout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows a loading message while the suggestion is being fetched', () => {
    vi.mocked(api.getSuggestions).mockImplementation(
      () => new Promise(() => {}),
    );

    render(<SuggestionCallout />);

    expect(
      screen.getByText(/looking for something to read/i),
    ).toBeInTheDocument();
  });

  it('marks the skeleton card aria-busy and announces via a polite live region while loading', () => {
    vi.mocked(api.getSuggestions).mockImplementation(
      () => new Promise(() => {}),
    );

    const { container } = render(<SuggestionCallout />);

    // The source-name paragraph holds the polite live region — the same
    // node persists from "Looking for…" to "How about…" so the swap
    // announces cleanly.
    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveAttribute('aria-atomic', 'true');
    expect(liveRegion).toHaveTextContent(/looking for something to read/i);

    // The card body wrapper carries aria-busy + the skeleton inside is
    // aria-hidden so SR users don't hear placeholder rectangles.
    const busyCard = container.querySelector('[aria-busy="true"]');
    expect(busyCard).toBeInTheDocument();
    expect(busyCard?.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('renders the picked source name above the suggestion title', async () => {
    vi.mocked(api.getSuggestions).mockResolvedValue({
      sourceName: 'Atlas Obscura',
      suggestions: [makeSuggestion({ title: 'Hidden hot springs' })],
    });

    render(<SuggestionCallout />);

    await waitFor(() => {
      expect(
        screen.getByText('How about something from Atlas Obscura?'),
      ).toBeInTheDocument();
    });
    expect(screen.getByText('Hidden hot springs')).toBeInTheDocument();
  });

  it('renders nothing when the suggestions endpoint returns an empty list', async () => {
    vi.mocked(api.getSuggestions).mockResolvedValue({
      sourceName: 'Aeon',
      suggestions: [],
    });

    const { container } = render(<SuggestionCallout />);

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it('renders nothing when the suggestions endpoint fails', async () => {
    vi.mocked(api.getSuggestions).mockRejectedValue(new Error('503'));

    const { container } = render(<SuggestionCallout />);

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it('renders the fallback prop in place of the callout on empty results', async () => {
    vi.mocked(api.getSuggestions).mockResolvedValue({
      sourceName: 'Aeon',
      suggestions: [],
    });

    render(<SuggestionCallout fallback={<p>Napping.</p>} />);

    await waitFor(() => {
      expect(screen.getByText('Napping.')).toBeInTheDocument();
    });
  });

  it('renders the fallback prop in place of the callout on fetch failure', async () => {
    vi.mocked(api.getSuggestions).mockRejectedValue(new Error('503'));

    render(<SuggestionCallout fallback={<p>Napping.</p>} />);

    await waitFor(() => {
      expect(screen.getByText('Napping.')).toBeInTheDocument();
    });
  });

  it('exposes the title via aria-describedby on the action button', async () => {
    vi.mocked(api.getSuggestions).mockResolvedValue({
      sourceName: 'Aeon',
      suggestions: [makeSuggestion({ title: 'A featured article' })],
    });

    render(<SuggestionCallout />);

    const button = await screen.findByRole('button', { name: /add and read/i });
    const describedById = button.getAttribute('aria-describedby');
    expect(describedById).toBeTruthy();
    const description = document.getElementById(describedById!);
    expect(description).toHaveTextContent('A featured article');
  });

  it('creates a link, marks it read, and navigates the current tab in same-tab mode', async () => {
    vi.mocked(api.getSuggestions).mockResolvedValue({
      sourceName: 'Aeon',
      suggestions: [makeSuggestion()],
    });
    vi.mocked(api.createLink).mockResolvedValue({
      id: 'new-link',
      url: 'https://example.com/featured',
      createdAt: '',
      updatedAt: '',
    });
    vi.mocked(api.readLink).mockResolvedValue({
      id: 'new-link',
      url: 'https://example.com/featured',
      createdAt: '',
      updatedAt: '',
      readAt: '2026-06-01T00:00:00Z',
    });

    const assignMock = vi.fn();
    vi.stubGlobal('location', { assign: assignMock });

    render(<SuggestionCallout />);

    const button = await screen.findByRole('button', { name: /add and read/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(api.createLink).toHaveBeenCalledWith({
        url: 'https://example.com/featured',
      });
    });
    await waitFor(() => {
      expect(api.readLink).toHaveBeenCalledWith('new-link');
    });
    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith('https://example.com/featured');
    });
  });

  it('opens a new tab synchronously and does not navigate the current tab in new-tab mode', async () => {
    vi.mocked(api.getSuggestions).mockResolvedValue({
      sourceName: 'Aeon',
      suggestions: [makeSuggestion()],
    });
    vi.mocked(api.createLink).mockResolvedValue({
      id: 'new-link',
      url: 'https://example.com/featured',
      createdAt: '',
      updatedAt: '',
    });
    vi.mocked(api.readLink).mockResolvedValue({
      id: 'new-link',
      url: 'https://example.com/featured',
      createdAt: '',
      updatedAt: '',
      readAt: '2026-06-01T00:00:00Z',
    });

    const openMock = vi.fn();
    const assignMock = vi.fn();
    vi.stubGlobal('open', openMock);
    vi.stubGlobal('location', { assign: assignMock });

    render(<SuggestionCallout inNewTab={true} />);

    const button = await screen.findByRole('button', {
      name: /add and read \(opens in new tab\)/i,
    });
    fireEvent.click(button);

    // window.open must be invoked synchronously inside the click handler
    // so that browser popup blockers honour the user activation.
    expect(openMock).toHaveBeenCalledWith(
      'https://example.com/featured',
      '_blank',
      'noopener,noreferrer',
    );

    await waitFor(() => {
      expect(api.readLink).toHaveBeenCalledWith('new-link');
    });
    expect(assignMock).not.toHaveBeenCalled();
  });

  it('extends the button accessible name with "(opens in new tab)" only when inNewTab is true', async () => {
    vi.mocked(api.getSuggestions).mockResolvedValue({
      sourceName: 'Aeon',
      suggestions: [makeSuggestion()],
    });

    const { rerender } = render(<SuggestionCallout />);
    let button = await screen.findByRole('button', { name: /add and read/i });
    expect(button.getAttribute('aria-label')).toBeNull();

    rerender(<SuggestionCallout inNewTab={true} />);
    button = await screen.findByRole('button', {
      name: /add and read \(opens in new tab\)/i,
    });
    expect(button).toHaveAttribute(
      'aria-label',
      'Add and read (opens in new tab)',
    );
  });

  it('marks the button as busy and disabled while the create request is in flight', async () => {
    vi.mocked(api.getSuggestions).mockResolvedValue({
      sourceName: 'Aeon',
      suggestions: [makeSuggestion()],
    });
    vi.mocked(api.createLink).mockImplementation(() => new Promise(() => {}));

    render(<SuggestionCallout />);

    const button = await screen.findByRole('button', { name: /add and read/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });
  });

  it('renders an error alert when createLink fails and reverts busy state', async () => {
    vi.mocked(api.getSuggestions).mockResolvedValue({
      sourceName: 'Aeon',
      suggestions: [makeSuggestion()],
    });
    vi.mocked(api.createLink).mockRejectedValue(new Error('Boom'));

    render(<SuggestionCallout />);

    const button = await screen.findByRole('button', { name: /add and read/i });
    fireEvent.click(button);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Boom');
    expect(button).toHaveAttribute('aria-busy', 'false');
  });

  it('ignores click attempts while a previous request is still in flight', async () => {
    vi.mocked(api.getSuggestions).mockResolvedValue({
      sourceName: 'Aeon',
      suggestions: [makeSuggestion()],
    });
    vi.mocked(api.createLink).mockImplementation(() => new Promise(() => {}));

    render(<SuggestionCallout />);

    const button = await screen.findByRole('button', { name: /add and read/i });
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => {
      expect(api.createLink).toHaveBeenCalledTimes(1);
    });
  });
});
