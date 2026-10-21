import { Tooltip } from "@fluentui/react-components";
import { ChevronDownRegular } from "@fluentui/react-icons";
import { forwardRef, type ReactNode } from "react";

export function RibbonGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="ribbon-group" aria-label={label}>
      <div className="ribbon-group-body">{children}</div>
      <div className="ribbon-group-label">{label}</div>
    </section>
  );
}

interface ToolButtonProps {
  icon: ReactNode;
  tip: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

/** Small square button in a ribbon grid (Tools, Image). */
export function ToolButton({ icon, tip, active, disabled, onClick }: ToolButtonProps) {
  return (
    <Tooltip content={tip} relationship="label" positioning="below" withArrow>
      <button className={`tool-btn${active ? " active" : ""}`} aria-pressed={active} disabled={disabled} onClick={onClick}>
        {icon}
      </button>
    </Tooltip>
  );
}

/** A big single button without a menu (Layers). */
export function ToolButtonLarge({ icon, tip, active, onClick }: ToolButtonProps) {
  return (
    <Tooltip content={tip} relationship="label" positioning="below" withArrow>
      <button className={`big-btn single${active ? " active" : ""}`} aria-pressed={active} onClick={onClick}>
        <span className="big-btn-icon">{icon}</span>
      </button>
    </Tooltip>
  );
}

interface BigButtonProps {
  icon: ReactNode;
  tip: string;
  active?: boolean;
  onClick?: () => void;
}

/** Large button with a chevron under it (Selection, Brushes, Shapes, Size). Used as a menu/popover trigger. */
export const BigButton = forwardRef<HTMLButtonElement, BigButtonProps & React.ButtonHTMLAttributes<HTMLButtonElement>>(
  function BigButton({ icon, tip, active, ...rest }, ref) {
    return (
      <Tooltip content={tip} relationship="label" positioning="below" withArrow>
        <button ref={ref} className={`big-btn${active ? " active" : ""}`} aria-pressed={active} {...rest}>
          <span className="big-btn-icon">{icon}</span>
          <ChevronDownRegular className="big-btn-chevron" />
        </button>
      </Tooltip>
    );
  },
);

/** Small button with a chevron to its right (Rotate, Flip). */
export const SplitSmallButton = forwardRef<HTMLButtonElement, { icon: ReactNode; tip: string } & React.ButtonHTMLAttributes<HTMLButtonElement>>(
  function SplitSmallButton({ icon, tip, ...rest }, ref) {
    return (
      <Tooltip content={tip} relationship="label" positioning="below" withArrow>
        <button ref={ref} className="tool-btn with-chevron" {...rest}>
          {icon}
          <ChevronDownRegular className="small-chevron" />
        </button>
      </Tooltip>
    );
  },
);

interface BigSplitProps {
  icon: ReactNode;
  tip: string;
  active?: boolean;
  onClick: () => void;
  /** The menu or popover whose trigger is a <ChevronButton>. */
  children: ReactNode;
}

/** Paint's split button: the icon picks the tool, the chevron under it opens the options. */
export function BigSplit({ icon, tip, active, onClick, children }: BigSplitProps) {
  return (
    <div className={`big-split${active ? " active" : ""}`}>
      <Tooltip content={tip} relationship="label" positioning="below" withArrow>
        <button className="big-split-main" aria-pressed={active} onClick={onClick}>
          {icon}
        </button>
      </Tooltip>
      {children}
    </div>
  );
}

export const ChevronButton = forwardRef<HTMLButtonElement, { label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>>(
  function ChevronButton({ label, ...rest }, ref) {
    return (
      <button ref={ref} className="big-split-chevron" aria-label={label} {...rest}>
        <ChevronDownRegular />
      </button>
    );
  },
);
