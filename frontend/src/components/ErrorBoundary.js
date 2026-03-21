import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[Cloudonomix] Uncaught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center',
          justifyContent: 'center', background: '#080c14', flexDirection: 'column', gap: '16px'
        }}>
          <div style={{ color: '#00d4ff', fontFamily: 'monospace', fontSize: '24px' }}>⬡ Cloudonomix</div>
          <div style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: 600 }}>Something went wrong</div>
          <div style={{ color: '#64748b', fontSize: '14px', maxWidth: '400px', textAlign: 'center' }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </div>
          <button
            onClick={() => window.location.href = '/'}
            style={{
              background: '#00d4ff', color: '#080c14', border: 'none',
              borderRadius: '8px', padding: '10px 24px', fontWeight: 700,
              cursor: 'pointer', fontSize: '14px', marginTop: '8px'
            }}
          >
            Return to Dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
