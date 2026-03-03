import { Paper, Stack, Text, Title } from "@mantine/core";
import { ReactNode } from "react";

export interface LoaderErrorProps {
  title?: string;
  children?: ReactNode;
}

export default function LoaderError({
  title = "Something went wrong",
  children,
}: LoaderErrorProps) {
  return (
    <Paper
      m={"md"}
      p={"md"}
      radius={"sm"}
      withBorder
      style={{
        backgroundColor: "#2b0000",
        borderColor: "#6b1111",
        color: "#ffffff",
        position: "relative",
        zIndex: 1000,
      }}
    >
      <Stack gap={"xs"}>
        <Title order={5} c={"red.2"}>
          {title}
        </Title>
        {typeof children === "string" ? <Text size={"sm"}>{children}</Text> : children}
      </Stack>
    </Paper>
  );
}
