import type { ComponentPropsWithoutRef } from 'react';
import { Button, type ButtonProps } from '@mantine/core';

type ClerkAuthButtonProps = ButtonProps &
  ComponentPropsWithoutRef<'button'> & {
    component?: string;
    clerk?: unknown;
  };

const ClerkAuthButton = ({
  component: _component,
  clerk: _clerk,
  ...props
}: ClerkAuthButtonProps) => <Button {...props} />;

export default ClerkAuthButton;
