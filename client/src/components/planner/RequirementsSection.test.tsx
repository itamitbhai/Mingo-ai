import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RequirementsSection } from './RequirementsSection';

describe('RequirementsSection', () => {
  it('renders explicit, inferred, missing, and assumptions in visually distinct sections', () => {
    render(
      <RequirementsSection
        requirements={{
          explicit: ['Use React'],
          inferred: ['Add authentication'],
          missing: ['Payment provider'],
        }}
        assumptions={['Users authenticate with email/password']}
      />
    );

    expect(screen.getByText('Use React')).toBeInTheDocument();
    expect(screen.getByText('Add authentication')).toBeInTheDocument();
    expect(screen.getByText('Payment provider')).toBeInTheDocument();
    expect(screen.getByText('Users authenticate with email/password')).toBeInTheDocument();

    // The inferred requirement must never appear under the "Explicit requirements" heading.
    const explicitCard = screen.getByText('Explicit requirements').closest('div');
    expect(explicitCard).not.toHaveTextContent('Add authentication');
  });

  it('shows an empty-state message when a category has nothing', () => {
    render(<RequirementsSection requirements={undefined} assumptions={undefined} />);

    expect(screen.getByText('Nothing explicit was detected.')).toBeInTheDocument();
    expect(screen.getByText('No inferred requirements.')).toBeInTheDocument();
    expect(screen.getByText('Nothing missing was flagged.')).toBeInTheDocument();
    expect(screen.getByText('No assumptions were needed.')).toBeInTheDocument();
  });
});
