type Props = React.SVGProps<SVGSVGElement>;

function Base({ children, ...props }: Props & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={22}
      height={22}
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconeMenu = (p: Props) => (
  <Base {...p}>
    <path d="M3 6h18M3 12h18M3 18h18" />
  </Base>
);

export const IconeCasa = (p: Props) => (
  <Base {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.8V20h14V9.8" />
    <path d="M9.5 20v-5.5h5V20" />
  </Base>
);

export const IconeLista = (p: Props) => (
  <Base {...p}>
    <path d="M8 6h13M8 12h13M8 18h13" />
    <circle cx="3.6" cy="6" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="3.6" cy="12" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="3.6" cy="18" r="1.1" fill="currentColor" stroke="none" />
  </Base>
);

export const IconeBistro = (p: Props) => (
  <Base {...p}>
    <ellipse cx="12" cy="6.5" rx="8" ry="2.8" />
    <path d="M12 9.3V19" />
    <path d="M7.5 21c1.2-1.6 2.8-2.4 4.5-2.4s3.3.8 4.5 2.4" />
  </Base>
);

export const IconeLounge = (p: Props) => (
  <Base {...p}>
    <path d="M4 11V8.5A2.5 2.5 0 0 1 6.5 6h11A2.5 2.5 0 0 1 20 8.5V11" />
    <path d="M3 11.5a2 2 0 0 1 2 2V17h14v-3.5a2 2 0 1 1 4 0V19H1v-5.5a2 2 0 0 1 2-2Z" />
    <path d="M5 19v2M19 19v2" />
  </Base>
);

export const IconeCalendario = (p: Props) => (
  <Base {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2.5" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Base>
);

export const IconeUsuarios = (p: Props) => (
  <Base {...p}>
    <circle cx="9" cy="8" r="3.4" />
    <path d="M2.8 20c.6-3.4 3.2-5.2 6.2-5.2s5.6 1.8 6.2 5.2" />
    <path d="M16.5 5.2a3.4 3.4 0 0 1 0 6.6M18 14.9c2.1.6 3.5 2.4 3.9 5.1" />
  </Base>
);

export const IconeSair = (p: Props) => (
  <Base {...p}>
    <path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14" />
    <path d="M9 8 5 12l4 4M5 12h10" />
  </Base>
);

export const IconeMais = (p: Props) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);

export const IconeBusca = (p: Props) => (
  <Base {...p}>
    <circle cx="10.8" cy="10.8" r="6.8" />
    <path d="m16 16 4.5 4.5" />
  </Base>
);

export const IconeCheck = (p: Props) => (
  <Base {...p}>
    <path d="m4.5 12.5 5 5 10-11" />
  </Base>
);

export const IconeFechar = (p: Props) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Base>
);

export const IconeSeta = (p: Props) => (
  <Base {...p}>
    <path d="m9 5 7 7-7 7" />
  </Base>
);

export const IconeAtualizar = (p: Props) => (
  <Base {...p}>
    <path d="M20 11a8 8 0 1 0-.8 4.4" />
    <path d="M20 4.5V11h-6.5" />
  </Base>
);

export const IconeAlerta = (p: Props) => (
  <Base {...p}>
    <path d="M12 4.5 21 19.5H3L12 4.5Z" />
    <path d="M12 10v4M12 17h.01" />
  </Base>
);

export const IconeCadeado = (p: Props) => (
  <Base {...p}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
  </Base>
);

export const IconeCadeadoAberto = (p: Props) => (
  <Base {...p}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
    <path d="M8 10.5V8a4 4 0 0 1 7.7-1.5" />
  </Base>
);

export const IconeLapis = (p: Props) => (
  <Base {...p}>
    <path d="M4 20h4L19.2 8.8a2.1 2.1 0 0 0-3-3L5 17v3Z" />
    <path d="m14.8 4.2 3 3" />
  </Base>
);

export const IconeLixeira = (p: Props) => (
  <Base {...p}>
    <path d="M4 7h16M9.5 7V4.8h5V7M6.5 7l.9 12.4A1.7 1.7 0 0 0 9.1 21h5.8a1.7 1.7 0 0 0 1.7-1.6L17.5 7" />
  </Base>
);

export const IconeWhatsapp = (p: Props) => (
  <Base {...p}>
    <path d="M21 11.6A8.6 8.6 0 0 1 8.3 19.3L3.5 20.5l1.3-4.6A8.6 8.6 0 1 1 21 11.6Z" />
    <path d="M8.9 8.4c.3-.1.6 0 .8.3l.7 1.2c.1.3.1.6-.1.8l-.4.5c.5 1 1.3 1.8 2.3 2.3l.5-.4c.2-.2.5-.3.8-.1l1.2.7c.3.2.4.5.3.8-.3.9-1.3 1.4-2.2 1.1-2.4-.7-4.3-2.6-5-5-.3-.9.2-1.9 1.1-2.2Z" />
  </Base>
);

export const IconeEngrenagem = (p: Props) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2.8v2.4M12 18.8v2.4M4.5 7.5l2 1.2M17.5 15.3l2 1.2M4.5 16.5l2-1.2M17.5 8.7l2-1.2" />
  </Base>
);

export const IconeMapa = (p: Props) => (
  <Base {...p}>
    <path d="M9 4.2 3.5 6.4v13.4L9 17.6l6 2.2 5.5-2.2V4.2L15 6.4 9 4.2Z" />
    <path d="M9 4.2v13.4M15 6.4v13.4" />
  </Base>
);

export const IconeMesa = (p: Props) => (
  <Base {...p}>
    <rect x="4.5" y="8.5" width="15" height="7" rx="1.6" />
    <path d="M7.5 15.5V19M16.5 15.5V19M4.5 12h15" />
  </Base>
);

export const IconeCopiar = (p: Props) => (
  <Base {...p}>
    <rect x="9" y="9" width="11.5" height="11.5" rx="2.2" />
    <path d="M15 6.2V5.5A2 2 0 0 0 13 3.5H5.5a2 2 0 0 0-2 2V13a2 2 0 0 0 2 2h.7" />
  </Base>
);

export const IconeMover = (p: Props) => (
  <Base {...p}>
    <path d="M7.5 8.5 4 12l3.5 3.5" />
    <path d="M4 12h9.5" />
    <path d="M16.5 4.5 20 8l-3.5 3.5" />
    <path d="M20 8h-9.5" />
  </Base>
);

export const IconeLink = (p: Props) => (
  <Base {...p}>
    <path d="M10.5 13.5a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7L11.9 6.4" />
    <path d="M13.5 10.5a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7l1.6-1.6" />
  </Base>
);
