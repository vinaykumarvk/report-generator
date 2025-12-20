const listItems = [
  {
    title: 'Documentation',
    description: 'Read the architecture brief and environment setup instructions.',
    href: '/api/health',
    isExternal: false
  },
  {
    title: 'Services',
    description: 'Docker Compose includes Postgres with pgvector, Redis, and MinIO.',
    href: 'https://min.io/',
    isExternal: true
  },
  {
    title: 'Development',
    description: 'Use pnpm or npm to install dependencies and run Next.js.',
    href: 'https://nextjs.org/docs',
    isExternal: true
  }
];

export default function HomePage() {
  return (
    <main>
      <section>
        <h1>Report Generator</h1>
        <p>Next.js + Prisma + Docker compose bootstrap.</p>
        <ul>
          {listItems.map((item) => (
            <li key={item.title}>
              <a href={item.href} target={item.isExternal ? '_blank' : undefined} rel="noreferrer">
                {item.title}
              </a>
              <p>{item.description}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
