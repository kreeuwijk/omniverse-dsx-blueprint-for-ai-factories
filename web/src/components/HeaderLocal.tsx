/**
 * HeaderLocal - Simplified header for local streaming (no auth)
 */

import {
  ActionIcon,
  Flex,
  Group,
  Image,
  Text,
  Badge,
} from "@mantine/core";
import { IconMaximize, IconMinimize, IconX } from "@tabler/icons-react";
import Logo from "@/assets/Nvidia_Logo.png";

export interface HeaderLocalProps {
  fullScreen: boolean;
  onToggleFullScreen: () => void;
  onClose: () => void;
}

export default function HeaderLocal({
  fullScreen,
  onToggleFullScreen,
  onClose,
}: HeaderLocalProps) {
  return (
    <>
      <Flex bg={"black.0"} p={"md"} align={"center"} gap={"xs"}>
        <Group>
          <Image src={Logo} w={200} h={25} />
          <Text fw={700} c={"white"} size={"xl"}>
            Digital Twin
          </Text>
          <Badge color="cyan" variant="light" size="sm">
            Local Streaming
          </Badge>
        </Group>
        <Flex justify={"end"} flex={1}>
          {/* No user menu in local mode */}
        </Flex>
      </Flex>
      <Flex
        bg={"black.0"}
        p={"xs"}
        justify={"end"}
        gap={"xl"}
        style={{ borderTop: "1px solid #222" }}
      >
        <ActionIcon
          variant={"outline"}
          color={"gray"}
          size={"16"}
          title={"Toggle fullscreen"}
          onClick={onToggleFullScreen}
        >
          {fullScreen ? <IconMinimize /> : <IconMaximize />}
        </ActionIcon>
        <ActionIcon
          variant={"outline"}
          color={"gray"}
          size={"16"}
          title={"Close"}
          onClick={onClose}
        >
          <IconX />
        </ActionIcon>
      </Flex>
    </>
  );
}
