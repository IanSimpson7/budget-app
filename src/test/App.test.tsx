import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../App'

describe('App (FOUND-01 smoke)', () => {
  it('renders the Budget app shell', () => {
    render(<App />)
    expect(screen.getByText(/Budget/i)).toBeInTheDocument()
  })
})
