const features = [
  {
    title: 'Reports Studio',
    description: 'Create and manage report templates with sections, validation, and versioning.',
    href: '/template-studio',
    icon: '📝',
    category: 'Studio'
  },
  {
    title: 'Runs',
    description: 'Monitor and manage report generation runs, track progress, and view results.',
    href: '/runs',
    icon: '🚀',
    category: 'Execution'
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
        <div className="grid grid-2">
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
