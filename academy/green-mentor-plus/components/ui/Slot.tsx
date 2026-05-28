"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils/cn";

interface SlotProps extends HTMLAttributes<HTMLElement> {
  children?: ReactNode;
}

/**
 * Minimal Radix-style `Slot` so consumers can do `<Button asChild><Link/></Button>`
 * and inherit the button's styling without wrapping markup. The child element
 * receives merged className, refs (via spread), and other props.
 */
export function Slot({ children, className, ...rest }: SlotProps) {
  if (!isValidElement(children)) {
    return null;
  }
  const child = Children.only(children) as ReactElement<
    HTMLAttributes<HTMLElement>
  >;
  const childProps = child.props;

  return cloneElement(child, {
    ...rest,
    ...childProps,
    className: cn(className, childProps.className),
  });
}
