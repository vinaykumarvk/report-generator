const features = [
  {
    title: 'Objective Studio',
    description: 'Create objectives with sections, validation, and versioning for reports.',
    href: '/template-studio',
    icon: '📝',
    category: 'Objectives'
  },
  {
    title: 'Run Dashboard',
    description: 'Monitor and manage report generation runs, track progress, and view results.',
    href: '/runs',
    icon: '🚀',
    category: 'Execution'
  },
  {
    title: 'Sources',
    description: 'Configure and manage sources for external data and integrations.',
    href: '/connectors',
    icon: '🔌',
    category: 'Integration'
  },
  {
    title: 'Model Configs',
    description: 'Manage AI model configurations, providers, and inference settings.',
    href: '/models',
    icon: '🤖',
    category: 'AI Models'
  },
  {
    title: 'Prompt Studio',
    description: 'Design, version, and manage prompts for AI-powered report generation.',
    href: '/prompts',
    icon: '💬',
    category: 'Prompts'
  },
  {
    title: 'Evidence Viewer',
    description: 'Browse and analyze evidence, citations, and source materials used in reports.',
    href: '/evidence',
    icon: '🔍',
    category: 'Data'
  },
  {
    title: 'Export Viewer',
    description: 'View and manage exported reports in various formats (PDF, DOCX, Markdown).',
    href: '/exports',
    icon: '📄',
    category: 'Export'
  },
  {
    title: 'Settings',
    description: 'Configure system settings, manage users, and access administrative tools.',
    href: '/settings',
    icon: '⚙️',
    category: 'Admin'
  }
];

export default function HomePage() {
  return (
    <div className="page-container">
      <div className="page-header-section">
        <div className="page-header-content">
          <h1>Report Generator</h1>
          <p className="page-description">
            A powerful platform for creating, managing, and generating intelligent reports
            with AI-powered insights and automated workflows.
          </p>
        </div>
      </div>

      <main>
        <div className="grid grid-4">
            {features.map((feature) => (
              <a key={feature.href} href={feature.href} className="card card-link">
                <div className="feature-card">
                  <span className="icon">{feature.icon}</span>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                  <span className="card-action">
                    Open {feature.title} →
                  </span>
                </div>
              </a>
            ))}
        </div>
      </main>
    </div>
  );
}
