import { Component } from 'react'

/**
 * Top-level error boundary so a render error in one module does not blank the
 * whole app. The weather engine keeps its data in the service layer, so a
 * reload recovers the last saved forecast.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Keep the console breadcrumb; no error reporting service is configured.
    console.error('MAUSAM crashed while rendering:', error, info?.componentStack)
  }

  handleReload = () => {
    if (typeof window !== 'undefined') window.location.reload()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="app">
        <main className="app__main">
          <div className="card state-message state-message--error" role="alert">
            <h2>Something went wrong</h2>
            <p>The weather engine hit an unexpected error while rendering. Your last saved forecast is kept in this browser.</p>
            <button type="button" className="button button--primary" onClick={this.handleReload}>
              Reload the app
            </button>
          </div>
        </main>
      </div>
    )
  }
}

export default ErrorBoundary
