'use client'
/**
 * Error boundary around a live demo: if a demo throws while rendering, the page
 * keeps its story, notes and navigation, and says honestly what happened.
 */
import { Component, type ReactNode } from 'react'
import { Button, ErrorState } from '@/components/ui'

interface State { error: Error | null; attempt: number }

export class DemoBoundary extends Component<{ children: ReactNode; title: string }, State> {
  state: State = { error: null, attempt: 0 }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('[playground] demo crashed:', error)
  }

  private retry = () => this.setState((s) => ({ error: null, attempt: s.attempt + 1 }))

  render() {
    if (this.state.error) {
      return (
        <ErrorState
          title={`${this.props.title} stopped working`}
          action={<Button variant="secondary" size="sm" icon="refresh" onClick={this.retry}>Restart the demo</Button>}
        >
          The demo hit an error in your browser. Nothing was sent anywhere. Restarting usually fixes it; the notes
          below still explain how it works.
        </ErrorState>
      )
    }
    return <div key={this.state.attempt} className="min-w-0">{this.props.children}</div>
  }
}
