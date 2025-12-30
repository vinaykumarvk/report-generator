/**
 * Seed Script for Report Templates
 * Creates 6 professional report templates with sections
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const reportTemplates = [
  {
    name: 'Company Research Report',
    description: 'A comprehensive, structured research report on a company covering business overview, industry positioning, financial performance, competitive landscape, risks, and future outlook. Designed to support investment analysis, strategic decision-making, and executive briefings.',
    audience: 'Equity research analysts, investment managers, relationship managers, senior leadership, strategy teams',
    tone: 'Analytical, objective, data-driven, professional',
    domain: 'Equity Research, Corporate Analysis, Financial Markets, Strategy',
    jurisdiction: 'Global (customizable per company: US, India, EU, GCC, APAC)',
    formats: ['markdown', 'docx', 'pdf'],
    status: 'ACTIVE',
    sections: [
      {
        title: 'Executive Summary',
        purpose: 'Provide a high-level overview of the company, key findings, investment thesis, and main recommendations in a concise format for quick decision-making.',
        order: 1,
        output_format: 'NARRATIVE',
        evidence_policy: 'ALL',
        target_length_min: 200,
        target_length_max: 400,
        status: 'ACTIVE'
      },
      {
        title: 'Business Overview',
        purpose: 'Describe the company\'s business model, products/services, revenue streams, geographic presence, and organizational structure.',
        order: 2,
        output_format: 'NARRATIVE',
        evidence_policy: 'VECTOR_WEB',
        target_length_min: 400,
        target_length_max: 600,
        status: 'ACTIVE'
      },
      {
        title: 'Industry Positioning',
        purpose: 'Analyze the company\'s position within its industry, market share, competitive advantages, and differentiation factors.',
        order: 3,
        output_format: 'NARRATIVE',
        evidence_policy: 'WEB_LLM',
        target_length_min: 300,
        target_length_max: 500,
        status: 'ACTIVE'
      },
      {
        title: 'Financial Performance',
        purpose: 'Present key financial metrics, revenue trends, profitability, cash flow, and financial health indicators over the past 3-5 years.',
        order: 4,
        output_format: 'TABLE',
        evidence_policy: 'VECTOR_ONLY',
        target_length_min: 400,
        target_length_max: 600,
        status: 'ACTIVE'
      },
      {
        title: 'Competitive Landscape',
        purpose: 'Identify and analyze key competitors, market dynamics, barriers to entry, and the company\'s competitive positioning.',
        order: 5,
        output_format: 'NARRATIVE',
        evidence_policy: 'WEB_ONLY',
        target_length_min: 300,
        target_length_max: 500,
        status: 'ACTIVE'
      },
      {
        title: 'Risks and Challenges',
        purpose: 'Outline operational, financial, regulatory, and market risks that could impact the company\'s performance.',
        order: 6,
        output_format: 'BULLETS',
        evidence_policy: 'ALL',
        target_length_min: 200,
        target_length_max: 400,
        status: 'ACTIVE'
      },
      {
        title: 'Future Outlook',
        purpose: 'Provide forward-looking analysis including growth prospects, strategic initiatives, market opportunities, and recommendations.',
        order: 7,
        output_format: 'NARRATIVE',
        evidence_policy: 'LLM_ONLY',
        target_length_min: 300,
        target_length_max: 500,
        status: 'ACTIVE'
      }
    ]
  },
  {
    name: 'RFP Response',
    description: 'A structured response to a Request for Proposal (RFP) that addresses client requirements, demonstrates capabilities, and presents a compelling value proposition.',
    audience: 'Procurement teams, decision-makers, evaluation committees',
    tone: 'Professional, persuasive, client-focused, solution-oriented',
    domain: 'Sales, Business Development, Consulting',
    jurisdiction: 'Global',
    formats: ['markdown', 'docx', 'pdf'],
    status: 'ACTIVE',
    sections: [
      {
        title: 'Executive Summary',
        purpose: 'Summarize the proposal, highlight key differentiators, and provide a compelling overview of why the organization is the best choice.',
        order: 1,
        output_format: 'NARRATIVE',
        evidence_policy: 'VECTOR_LLM',
        target_length_min: 200,
        target_length_max: 400,
        status: 'ACTIVE'
      },
      {
        title: 'Understanding of Requirements',
        purpose: 'Demonstrate clear understanding of the client\'s needs, challenges, and objectives as outlined in the RFP.',
        order: 2,
        output_format: 'NARRATIVE',
        evidence_policy: 'VECTOR_ONLY',
        target_length_min: 300,
        target_length_max: 500,
        status: 'ACTIVE'
      },
      {
        title: 'Proposed Solution',
        purpose: 'Detail the proposed approach, methodology, deliverables, and how the solution addresses each requirement.',
        order: 3,
        output_format: 'NARRATIVE',
        evidence_policy: 'VECTOR_WEB',
        target_length_min: 500,
        target_length_max: 800,
        status: 'ACTIVE'
      },
      {
        title: 'Company Qualifications',
        purpose: 'Showcase relevant experience, credentials, certifications, case studies, and past successes.',
        order: 4,
        output_format: 'NARRATIVE',
        evidence_policy: 'VECTOR_ONLY',
        target_length_min: 300,
        target_length_max: 500,
        status: 'ACTIVE'
      },
      {
        title: 'Project Timeline',
        purpose: 'Provide a detailed implementation timeline with milestones, phases, and key deliverables.',
        order: 5,
        output_format: 'TABLE',
        evidence_policy: 'LLM_ONLY',
        target_length_min: 200,
        target_length_max: 400,
        status: 'ACTIVE'
      },
      {
        title: 'Pricing and Commercial Terms',
        purpose: 'Present pricing structure, payment terms, and commercial conditions in a clear and transparent manner.',
        order: 6,
        output_format: 'TABLE',
        evidence_policy: 'VECTOR_LLM',
        target_length_min: 200,
        target_length_max: 400,
        status: 'ACTIVE'
      },
      {
        title: 'Risk Mitigation',
        purpose: 'Identify potential risks and outline mitigation strategies to ensure project success.',
        order: 7,
        output_format: 'BULLETS',
        evidence_policy: 'ALL',
        target_length_min: 200,
        target_length_max: 300,
        status: 'ACTIVE'
      }
    ]
  },
  {
    name: 'Business Requirement Document',
    description: 'A comprehensive document that captures business requirements, functional specifications, and technical constraints for a project or system implementation.',
    audience: 'Product managers, developers, business analysts, stakeholders',
    tone: 'Clear, precise, structured, technical',
    domain: 'Product Management, Software Development, Business Analysis',
    jurisdiction: 'Global',
    formats: ['markdown', 'docx'],
    status: 'ACTIVE',
    sections: [
      {
        title: 'Document Overview',
        purpose: 'Provide context, scope, objectives, and key stakeholders for the business requirements document.',
        order: 1,
        output_format: 'NARRATIVE',
        evidence_policy: 'VECTOR_LLM',
        target_length_min: 200,
        target_length_max: 300,
        status: 'ACTIVE'
      },
      {
        title: 'Business Context',
        purpose: 'Describe the business problem, opportunity, current state, and desired future state.',
        order: 2,
        output_format: 'NARRATIVE',
        evidence_policy: 'VECTOR_ONLY',
        target_length_min: 300,
        target_length_max: 500,
        status: 'ACTIVE'
      },
      {
        title: 'Functional Requirements',
        purpose: 'List detailed functional requirements with clear acceptance criteria and priority levels.',
        order: 3,
        output_format: 'REQUIREMENTS',
        evidence_policy: 'VECTOR_WEB',
        target_length_min: 500,
        target_length_max: 1000,
        status: 'ACTIVE'
      },
      {
        title: 'Non-Functional Requirements',
        purpose: 'Specify performance, security, scalability, usability, and other non-functional requirements.',
        order: 4,
        output_format: 'REQUIREMENTS',
        evidence_policy: 'VECTOR_LLM',
        target_length_min: 300,
        target_length_max: 500,
        status: 'ACTIVE'
      },
      {
        title: 'User Stories and Use Cases',
        purpose: 'Provide user stories, use cases, and scenarios that illustrate how users will interact with the system.',
        order: 5,
        output_format: 'NARRATIVE',
        evidence_policy: 'VECTOR_ONLY',
        target_length_min: 400,
        target_length_max: 600,
        status: 'ACTIVE'
      },
      {
        title: 'Assumptions and Constraints',
        purpose: 'Document assumptions, dependencies, technical constraints, and limitations.',
        order: 6,
        output_format: 'BULLETS',
        evidence_policy: 'ALL',
        target_length_min: 200,
        target_length_max: 300,
        status: 'ACTIVE'
      },
      {
        title: 'Success Criteria',
        purpose: 'Define measurable success criteria, KPIs, and acceptance criteria for the project.',
        order: 7,
        output_format: 'TABLE',
        evidence_policy: 'LLM_ONLY',
        target_length_min: 200,
        target_length_max: 300,
        status: 'ACTIVE'
      }
    ]
  },
  {
    name: 'Test Case Generator',
    description: 'Automated generation of comprehensive test cases covering functional, edge, and negative scenarios for software testing.',
    audience: 'QA engineers, test managers, developers',
    tone: 'Precise, structured, technical, comprehensive',
    domain: 'Quality Assurance, Software Testing',
    jurisdiction: 'Global',
    formats: ['markdown', 'docx'],
    status: 'ACTIVE',
    sections: [
      {
        title: 'Test Plan Overview',
        purpose: 'Provide overview of testing scope, objectives, test environment, and testing approach.',
        order: 1,
        output_format: 'NARRATIVE',
        evidence_policy: 'VECTOR_LLM',
        target_length_min: 200,
        target_length_max: 300,
        status: 'ACTIVE'
      },
      {
        title: 'Functional Test Cases',
        purpose: 'Generate detailed test cases for all functional requirements with steps, expected results, and test data.',
        order: 2,
        output_format: 'TABLE',
        evidence_policy: 'VECTOR_ONLY',
        target_length_min: 500,
        target_length_max: 1000,
        status: 'ACTIVE'
      },
      {
        title: 'Edge Case Scenarios',
        purpose: 'Identify and document edge cases, boundary conditions, and unusual scenarios that need testing.',
        order: 3,
        output_format: 'TABLE',
        evidence_policy: 'VECTOR_LLM',
        target_length_min: 300,
        target_length_max: 600,
        status: 'ACTIVE'
      },
      {
        title: 'Negative Test Cases',
        purpose: 'Create test cases for invalid inputs, error conditions, and failure scenarios.',
        order: 4,
        output_format: 'TABLE',
        evidence_policy: 'VECTOR_WEB',
        target_length_min: 300,
        target_length_max: 500,
        status: 'ACTIVE'
      },
      {
        title: 'Integration Test Cases',
        purpose: 'Document test cases for system integration points, APIs, and data flow between components.',
        order: 5,
        output_format: 'TABLE',
        evidence_policy: 'VECTOR_ONLY',
        target_length_min: 300,
        target_length_max: 500,
        status: 'ACTIVE'
      },
      {
        title: 'Performance Test Scenarios',
        purpose: 'Define performance, load, and stress testing scenarios with expected benchmarks.',
        order: 6,
        output_format: 'TABLE',
        evidence_policy: 'LLM_ONLY',
        target_length_min: 200,
        target_length_max: 400,
        status: 'ACTIVE'
      },
      {
        title: 'Test Data Requirements',
        purpose: 'Specify test data requirements, data setup procedures, and data cleanup steps.',
        order: 7,
        output_format: 'BULLETS',
        evidence_policy: 'ALL',
        target_length_min: 200,
        target_length_max: 300,
        status: 'ACTIVE'
      }
    ]
  },
  {
    name: 'Client Report',
    description: 'A professional client-facing report providing updates, insights, performance metrics, and recommendations tailored to client needs.',
    audience: 'Clients, account managers, senior stakeholders',
    tone: 'Professional, clear, client-focused, actionable',
    domain: 'Account Management, Consulting, Client Services',
    jurisdiction: 'Global',
    formats: ['markdown', 'docx', 'pdf'],
    status: 'ACTIVE',
    sections: [
      {
        title: 'Executive Summary',
        purpose: 'Provide a high-level summary of key activities, achievements, and recommendations for the reporting period.',
        order: 1,
        output_format: 'NARRATIVE',
        evidence_policy: 'VECTOR_LLM',
        target_length_min: 200,
        target_length_max: 400,
        status: 'ACTIVE'
      },
      {
        title: 'Period Overview',
        purpose: 'Summarize activities, milestones, and deliverables completed during the reporting period.',
        order: 2,
        output_format: 'NARRATIVE',
        evidence_policy: 'VECTOR_ONLY',
        target_length_min: 300,
        target_length_max: 500,
        status: 'ACTIVE'
      },
      {
        title: 'Performance Metrics',
        purpose: 'Present key performance indicators, metrics, and progress against agreed targets and SLAs.',
        order: 3,
        output_format: 'TABLE',
        evidence_policy: 'VECTOR_WEB',
        target_length_min: 300,
        target_length_max: 500,
        status: 'ACTIVE'
      },
      {
        title: 'Key Achievements',
        purpose: 'Highlight significant accomplishments, successes, and value delivered to the client.',
        order: 4,
        output_format: 'BULLETS',
        evidence_policy: 'VECTOR_ONLY',
        target_length_min: 200,
        target_length_max: 400,
        status: 'ACTIVE'
      },
      {
        title: 'Challenges and Issues',
        purpose: 'Transparently communicate any challenges faced, issues encountered, and resolution status.',
        order: 5,
        output_format: 'NARRATIVE',
        evidence_policy: 'ALL',
        target_length_min: 200,
        target_length_max: 400,
        status: 'ACTIVE'
      },
      {
        title: 'Upcoming Activities',
        purpose: 'Outline planned activities, initiatives, and deliverables for the next reporting period.',
        order: 6,
        output_format: 'BULLETS',
        evidence_policy: 'VECTOR_LLM',
        target_length_min: 200,
        target_length_max: 300,
        status: 'ACTIVE'
      },
      {
        title: 'Recommendations',
        purpose: 'Provide actionable recommendations, optimization opportunities, and strategic suggestions.',
        order: 7,
        output_format: 'NARRATIVE',
        evidence_policy: 'LLM_ONLY',
        target_length_min: 200,
        target_length_max: 400,
        status: 'ACTIVE'
      }
    ]
  },
  {
    name: 'RM Performance Report',
    description: 'A comprehensive performance report for Relationship Managers tracking client engagement, revenue generation, portfolio growth, and key performance indicators.',
    audience: 'Senior management, HR, sales leadership',
    tone: 'Analytical, objective, data-driven, professional',
    domain: 'Wealth Management, Private Banking, Sales Performance',
    jurisdiction: 'Global',
    formats: ['markdown', 'docx', 'pdf'],
    status: 'ACTIVE',
    sections: [
      {
        title: 'Executive Summary',
        purpose: 'Provide an overview of RM performance, key highlights, and overall assessment for the review period.',
        order: 1,
        output_format: 'NARRATIVE',
        evidence_policy: 'VECTOR_LLM',
        target_length_min: 200,
        target_length_max: 300,
        status: 'ACTIVE'
      },
      {
        title: 'Portfolio Overview',
        purpose: 'Summarize the RM\'s client portfolio including number of clients, AUM, client segments, and portfolio composition.',
        order: 2,
        output_format: 'TABLE',
        evidence_policy: 'VECTOR_ONLY',
        target_length_min: 300,
        target_length_max: 500,
        status: 'ACTIVE'
      },
      {
        title: 'Revenue Performance',
        purpose: 'Analyze revenue generation, fee income, product sales, and performance against targets.',
        order: 3,
        output_format: 'TABLE',
        evidence_policy: 'VECTOR_WEB',
        target_length_min: 300,
        target_length_max: 500,
        status: 'ACTIVE'
      },
      {
        title: 'Client Acquisition',
        purpose: 'Report on new client onboarding, acquisition channels, and quality of new relationships.',
        order: 4,
        output_format: 'NARRATIVE',
        evidence_policy: 'VECTOR_ONLY',
        target_length_min: 200,
        target_length_max: 400,
        status: 'ACTIVE'
      },
      {
        title: 'Client Engagement',
        purpose: 'Assess client interaction frequency, meeting quality, client satisfaction, and relationship depth.',
        order: 5,
        output_format: 'NARRATIVE',
        evidence_policy: 'VECTOR_LLM',
        target_length_min: 200,
        target_length_max: 400,
        status: 'ACTIVE'
      },
      {
        title: 'Product Penetration',
        purpose: 'Analyze cross-selling success, product mix, wallet share, and opportunities for deeper penetration.',
        order: 6,
        output_format: 'TABLE',
        evidence_policy: 'VECTOR_ONLY',
        target_length_min: 200,
        target_length_max: 400,
        status: 'ACTIVE'
      },
      {
        title: 'Compliance and Risk',
        purpose: 'Review compliance adherence, risk management practices, and any regulatory or policy violations.',
        order: 7,
        output_format: 'NARRATIVE',
        evidence_policy: 'ALL',
        target_length_min: 200,
        target_length_max: 300,
        status: 'ACTIVE'
      },
      {
        title: 'Development Areas',
        purpose: 'Identify skill gaps, training needs, and areas for professional development and improvement.',
        order: 8,
        output_format: 'BULLETS',
        evidence_policy: 'LLM_ONLY',
        target_length_min: 200,
        target_length_max: 300,
        status: 'ACTIVE'
      }
    ]
  }
];

async function seedTemplates() {
  console.log('🌱 Starting template seeding...\n');

  for (const template of reportTemplates) {
    try {
      console.log(`📝 Creating template: ${template.name}`);
      
      // Extract sections
      const sections = template.sections;
      delete template.sections;

      // Insert template
      const { data: templateData, error: templateError } = await supabase
        .from('templates')
        .insert([template])
        .select()
        .single();

      if (templateError) {
        console.error(`  ❌ Failed to create template: ${templateError.message}`);
        continue;
      }

      console.log(`  ✅ Template created with ID: ${templateData.id}`);

      // Insert sections
      const sectionsToInsert = sections.map(section => ({
        ...section,
        template_id: templateData.id
      }));

      const { data: sectionsData, error: sectionsError } = await supabase
        .from('template_sections')
        .insert(sectionsToInsert)
        .select();

      if (sectionsError) {
        console.error(`  ❌ Failed to create sections: ${sectionsError.message}`);
      } else {
        console.log(`  ✅ Created ${sectionsData.length} sections`);
      }

      console.log('');
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}\n`);
    }
  }

  console.log('✅ Seeding completed!\n');
}

// Run the seed script
seedTemplates()
  .then(() => {
    console.log('🎉 All templates seeded successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  });

