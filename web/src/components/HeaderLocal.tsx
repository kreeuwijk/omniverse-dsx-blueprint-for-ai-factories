/**
 * HeaderLocal - Simplified header for local streaming (no auth)
 */

import {
  Flex,
  Group,
  Image,
  Text,
  Badge,
} from "@mantine/core";
import Logo from "@/assets/Nvidia_Logo.png";

export default function HeaderLocal() {
  return (
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
  );
}
