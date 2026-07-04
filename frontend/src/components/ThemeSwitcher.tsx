import { ActionIcon, ColorSwatch, Group, Menu, Stack, Text, Tooltip } from '@mantine/core'
import { IconCheck, IconPalette } from '@tabler/icons-react'
import { useAppTheme } from '../lib/themeContext'
import { appThemes } from '../lib/themes'

const ThemeSwitcher = () => {
  const { appTheme, setThemeId } = useAppTheme()

  return (
    <Menu position="bottom-end" width={280} withArrow>
      <Menu.Target>
        <Tooltip label="Preview themes">
          <ActionIcon variant="subtle" color="gray" size="lg" aria-label="Preview themes">
            <IconPalette size={20} />
          </ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Themes</Menu.Label>
        {appThemes.map((themeOption) => (
          <Menu.Item
            key={themeOption.id}
            onClick={() => setThemeId(themeOption.id)}
            leftSection={<ColorSwatch color={themeOption.swatch} size={18} />}
            rightSection={
              themeOption.id === appTheme.id ? <IconCheck size={16} /> : null
            }
          >
            <Stack gap={0}>
              <Group gap={6}>
                <Text size="sm" fw={500}>
                  {themeOption.label}
                </Text>
              </Group>
              <Text size="xs" c="dimmed">
                {themeOption.description}
              </Text>
            </Stack>
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  )
}

export default ThemeSwitcher
