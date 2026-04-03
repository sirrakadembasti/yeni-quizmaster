import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { Input } from '../input';

describe('Input Component', () => {
  it('renders correctly', () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText(/enter text/i)).toBeInTheDocument();
  });

  it('allows user to type', async () => {
    render(<Input placeholder="Type here" />);
    const input = screen.getByPlaceholderText(/type here/i);
    
    await userEvent.type(input, 'Hello World');
    
    expect(input).toHaveValue('Hello World');
  });

  it('is disabled when disabled prop is true', () => {
    render(<Input disabled placeholder="Disabled input" />);
    expect(screen.getByPlaceholderText(/disabled input/i)).toBeDisabled();
  });

  it('applies custom classes', () => {
    render(<Input className="custom-class" data-testid="custom-input" />);
    expect(screen.getByTestId('custom-input')).toHaveClass('custom-class');
  });

  it('handles different types', () => {
    render(<Input type="password" data-testid="password-input" />);
    expect(screen.getByTestId('password-input')).toHaveAttribute('type', 'password');
  });
});
