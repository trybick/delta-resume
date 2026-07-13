import { Alert, Container, Stack, Text, Title } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

type FullPageErrorProps = {
  message: string;
};

const FullPageError = ({ message }: FullPageErrorProps) => (
  <Container size="sm" py="xl">
    <Stack gap="md">
      <Title order={2}>Something went wrong</Title>
      <Alert color="red" icon={<IconAlertCircle size={18} />} title="App cannot start">
        <Text size="sm">{message}</Text>
      </Alert>
    </Stack>
  </Container>
);

export default FullPageError;
