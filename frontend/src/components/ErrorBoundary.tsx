import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button, Stack } from '@mantine/core'
import { IconRefresh } from '@tabler/icons-react'
import FullPageError from './FullPageError'

type ErrorBoundaryProps = {
  children: ReactNode
}

type ErrorBoundaryState = {
  error: Error | null
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Uncaught render error:', error, info.componentStack)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    const { error } = this.state

    if (error) {
      return (
        <Stack gap="md" align="center">
          <FullPageError message={error.message} />
          <Button
            leftSection={<IconRefresh size={16} />}
            onClick={this.handleReload}
            w="fit-content"
          >
            Reload page
          </Button>
        </Stack>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
