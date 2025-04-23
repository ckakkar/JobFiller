/**
 * PDF Resume Parser
 * Uses PDF.js to extract text from PDF files and structures it into JSON format
 */

class ResumeParser {
  constructor() {
    this.pdfjs = window['pdfjs-dist/build/pdf'];
    // Set the PDF.js worker source
    this.pdfjs.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.js');
  }

  /**
   * Parse a PDF file into a structured JSON resume
   * @param {ArrayBuffer} pdfData - The PDF file data as ArrayBuffer
   * @returns {Promise<Object>} - Parsed resume data as JSON
   */
  async parsePDF(pdfData) {
    try {
      const pdf = await this.pdfjs.getDocument({ data: pdfData }).promise;
      let fullText = '';
      
      // Extract text from all pages
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
      }
      
      // Parse the text into structured resume sections
      return this.parseResumeText(fullText);
    } catch (error) {
      console.error('Error parsing PDF:', error);
      throw new Error('Failed to parse PDF: ' + error.message);
    }
  }

  /**
   * Parse extracted text into structured resume data
   * @param {string} text - Full text from the PDF
   * @returns {Object} - Structured resume data
   */
  parseResumeText(text) {
    // Initialize resume structure
    const resume = {
      personal: {
        name: '',
        email: '',
        phone: '',
        address: '',
        linkedin: '',
        website: ''
      },
      summary: '',
      experience: [],
      education: [],
      skills: [],
      certifications: [],
      projects: []
    };

    // Extract personal info
    resume.personal.name = this.extractName(text);
    resume.personal.email = this.extractEmail(text);
    resume.personal.phone = this.extractPhone(text);
    resume.personal.address = this.extractAddress(text);
    resume.personal.linkedin = this.extractLinkedIn(text);
    resume.personal.website = this.extractWebsite(text);

    // Extract sections
    const sections = this.splitIntoSections(text);
    
    // Process sections
    for (const [title, content] of Object.entries(sections)) {
      if (this.isSummarySection(title)) {
        resume.summary = content.trim();
      } else if (this.isExperienceSection(title)) {
        resume.experience = this.parseExperienceSection(content);
      } else if (this.isEducationSection(title)) {
        resume.education = this.parseEducationSection(content);
      } else if (this.isSkillsSection(title)) {
        resume.skills = this.parseSkillsSection(content);
      } else if (this.isCertificationsSection(title)) {
        resume.certifications = this.parseCertificationsSection(content);
      } else if (this.isProjectsSection(title)) {
        resume.projects = this.parseProjectsSection(content);
      }
    }

    return resume;
  }

  /**
   * Extract the candidate's name from the resume text
   */
  extractName(text) {
    // Usually the name is at the beginning of the resume
    // and is on a line by itself with a larger font
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    
    // Assume the first non-empty line that's not an email/phone/URL is the name
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i];
      if (
        line && 
        !line.includes('@') && 
        !line.match(/^\d{3}[-.\s]?\d{3}[-.\s]?\d{4}$/) &&
        !line.includes('http') &&
        !line.includes('www.')
      ) {
        return line;
      }
    }
    return '';
  }

  /**
   * Extract email address
   */
  extractEmail(text) {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
    const match = text.match(emailRegex);
    return match ? match[0] : '';
  }

  /**
   * Extract phone number
   */
  extractPhone(text) {
    const phoneRegex = /(\+\d{1,2}\s?)?(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/;
    const match = text.match(phoneRegex);
    return match ? match[0] : '';
  }

  /**
   * Extract address
   */
  extractAddress(text) {
    // Simplistic approach - find lines that might be addresses
    // Look for patterns like "City, State ZIP" or common address formats
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      // Look for "City, State ZIP" pattern
      if (/[A-Za-z\s]+,\s*[A-Z]{2}\s*\d{5}/.test(trimmed)) {
        return trimmed;
      }
    }
    return '';
  }

  /**
   * Extract LinkedIn URL
   */
  extractLinkedIn(text) {
    const linkedinRegex = /linkedin\.com\/in\/[a-zA-Z0-9-]+/;
    const match = text.match(linkedinRegex);
    return match ? 'https://www.' + match[0] : '';
  }

  /**
   * Extract website URL
   */
  extractWebsite(text) {
    const websiteRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/;
    const match = text.match(websiteRegex);
    if (!match) return '';
    
    // If it's LinkedIn, it's not a personal website
    if (match[0].includes('linkedin.com')) return '';
    
    return match[0].startsWith('http') ? match[0] : 'https://' + match[0];
  }

  /**
   * Split resume text into logical sections
   */
  splitIntoSections(text) {
    const sections = {};
    const lines = text.split('\n');
    
    let currentSection = 'header';
    sections[currentSection] = '';
    
    const sectionHeaders = [
      'summary', 'objective', 'profile', 
      'experience', 'work', 'employment', 
      'education', 'academic', 
      'skills', 'abilities', 'competencies',
      'certifications', 'certificates', 'licenses',
      'projects', 'portfolio',
      'awards', 'honors', 'achievements'
    ];
    
    // Regex to match section headers (capitalized words followed by colon or newline)
    const sectionRegex = new RegExp(`^\\s*(${sectionHeaders.join('|')}):?\\s*$`, 'i');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Check if this line looks like a section header
      if (trimmedLine.toUpperCase() === trimmedLine && trimmedLine.length > 3) {
        // All caps might be a header
        currentSection = trimmedLine.toLowerCase();
        sections[currentSection] = '';
      } else if (sectionRegex.test(trimmedLine)) {
        // Matches our known section headers
        currentSection = trimmedLine.toLowerCase().replace(':', '').trim();
        sections[currentSection] = '';
      } else {
        // Add content to current section
        sections[currentSection] += line + '\n';
      }
    }
    
    return sections;
  }

  isSummarySection(title) {
    return /summary|objective|profile|about/i.test(title);
  }

  isExperienceSection(title) {
    return /experience|work|employment|history|professional/i.test(title);
  }

  isEducationSection(title) {
    return /education|academic|degree|university|college|school/i.test(title);
  }

  isSkillsSection(title) {
    return /skills|abilities|competencies|expertise/i.test(title);
  }

  isCertificationsSection(title) {
    return /certifications|certificates|licenses/i.test(title);
  }

  isProjectsSection(title) {
    return /projects|portfolio/i.test(title);
  }

  /**
   * Parse the work experience section
   */
  parseExperienceSection(content) {
    const experiences = [];
    const lines = content.split('\n').map(line => line.trim()).filter(line => line);
    
    let currentJob = null;
    let collectingBullets = false;
    
    for (const line of lines) {
      // Look for job entry starts (typically company name or title)
      if (this.looksLikeJobHeader(line)) {
        // Save previous job if exists
        if (currentJob) {
          experiences.push(currentJob);
        }
        
        // Start new job entry
        currentJob = {
          company: '',
          title: '',
          startDate: '',
          endDate: '',
          location: '',
          description: '',
          bullets: []
        };
        
        // Try to extract company and title
        const companyTitleSplit = this.splitCompanyAndTitle(line);
        if (companyTitleSplit) {
          currentJob.company = companyTitleSplit.company;
          currentJob.title = companyTitleSplit.title;
        } else {
          // If we can't split, assume it's the company name
          currentJob.company = line;
        }
        
        collectingBullets = false;
      } 
      // Look for date ranges
      else if (this.looksLikeDateRange(line) && currentJob) {
        const dates = this.extractDates(line);
        if (dates) {
          currentJob.startDate = dates.startDate;
          currentJob.endDate = dates.endDate;
        }
        
        // Also try to extract location from the same line
        currentJob.location = this.extractLocation(line);
      }
      // Look for bullet points
      else if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*') || /^\d+\./.test(line)) {
        if (currentJob) {
          collectingBullets = true;
          currentJob.bullets.push(line.replace(/^[•\-*\d.]\s*/, '').trim());
        }
      }
      // If not a bullet but we're collecting, it could be a continuation
      else if (collectingBullets && currentJob && currentJob.bullets.length > 0) {
        // Append to the last bullet
        currentJob.bullets[currentJob.bullets.length - 1] += ' ' + line;
      }
      // If it looks like a job title (but not a header), capture it
      else if (currentJob && !currentJob.title && this.looksLikeJobTitle(line)) {
        currentJob.title = line;
      }
      // Add to description if nothing else matches
      else if (currentJob && !collectingBullets) {
        currentJob.description += (currentJob.description ? ' ' : '') + line;
      }
    }
    
    // Add the last job
    if (currentJob) {
      experiences.push(currentJob);
    }
    
    return experiences;
  }

  /**
   * Check if a line looks like a job header
   */
  looksLikeJobHeader(line) {
    // Job headers usually have company names (often in caps or with Inc, LLC, etc.)
    return (line.includes('Inc.') || 
            line.includes('LLC') || 
            line.includes('Ltd') || 
            line.includes('Company') ||
            /[A-Z]{2,}/.test(line)) && // Has multiple uppercase letters
           line.length < 100; // Not too long
  }

  /**
   * Check if a line looks like a job title
   */
  looksLikeJobTitle(line) {
    const jobTitles = [
      'manager', 'developer', 'engineer', 'director', 'assistant',
      'specialist', 'coordinator', 'analyst', 'associate', 'consultant',
      'supervisor', 'lead', 'head', 'chief', 'officer'
    ];
    
    return jobTitles.some(title => line.toLowerCase().includes(title)) &&
           line.length < 100; // Not too long
  }

  /**
   * Split company name and job title
   */
  splitCompanyAndTitle(line) {
    // Common patterns:
    // "Title at Company"
    // "Company - Title"
    // "Title | Company"
    
    if (line.includes(' at ')) {
      const parts = line.split(' at ');
      return {
        title: parts[0].trim(),
        company: parts.slice(1).join(' at ').trim()
      };
    }
    
    if (line.includes(' - ')) {
      const parts = line.split(' - ');
      // Usually company comes first
      return {
        company: parts[0].trim(),
        title: parts.slice(1).join(' - ').trim()
      };
    }
    
    if (line.includes(' | ')) {
      const parts = line.split(' | ');
      // Usually title comes first
      return {
        title: parts[0].trim(),
        company: parts.slice(1).join(' | ').trim() 
      };
    }
    
    // Can't determine the split
    return null;
  }

  /**
   * Check if a line looks like a date range
   */
  looksLikeDateRange(line) {
    const dateFormats = [
      /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{4}\b/i, // Month Year
      /\b\d{1,2}\/\d{4}\b/, // MM/YYYY
      /\b\d{4}\b/ // Just year
    ];
    
    // Check if the line has at least one date format and contains a separator like "-" or "to"
    return dateFormats.some(format => format.test(line)) && 
           (line.includes('-') || /\bto\b/i.test(line) || line.includes('–') || line.includes('—'));
  }

  /**
   * Extract start and end dates from a line
   */
  extractDates(line) {
    // Common date formats in resumes
    const dateRegex = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{4}\b|\b\d{1,2}\/\d{4}\b|\b\d{4}\b/gi;
    const dates = line.match(dateRegex);
    
    if (!dates || dates.length < 1) return null;
    
    return {
      startDate: dates[0],
      endDate: dates.length > 1 ? dates[1] : (line.toLowerCase().includes('present') ? 'Present' : '')
    };
  }

  /**
   * Extract location from a line
   */
  extractLocation(line) {
    // Look for city or city, state patterns
    const locationRegex = /\b[A-Z][a-z]+(?:[\s-][A-Z][a-z]+)*,\s*[A-Z]{2}\b/;
    const match = line.match(locationRegex);
    return match ? match[0] : '';
  }

  /**
   * Parse education section into structured format
   */
  parseEducationSection(content) {
    const education = [];
    const lines = content.split('\n').map(line => line.trim()).filter(line => line);
    
    let currentEdu = null;
    
    for (const line of lines) {
      // Look for school names (usually contain University, College, School, etc.)
      if (this.looksLikeSchool(line)) {
        // Save previous education if exists
        if (currentEdu) {
          education.push(currentEdu);
        }
        
        // Start new education entry
        currentEdu = {
          school: line,
          degree: '',
          field: '',
          graduationDate: '',
          gpa: '',
          location: '',
          achievements: []
        };
      }
      // Look for degree information
      else if (currentEdu && this.looksLikeDegree(line)) {
        currentEdu.degree = line;
        
        // Try to extract field of study
        const fieldMatch = line.match(/in\s+([^,\.]+)/i);
        if (fieldMatch) {
          currentEdu.field = fieldMatch[1].trim();
        }
      }
      // Look for graduation date
      else if (currentEdu && this.looksLikeGraduationDate(line)) {
        const dateMatch = line.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{4}|\d{4}/i);
        if (dateMatch) {
          currentEdu.graduationDate = dateMatch[0];
        }
      }
      // Look for GPA
      else if (currentEdu && line.toLowerCase().includes('gpa')) {
        const gpaMatch = line.match(/\b[0-9]\.[0-9][0-9]?\b/);
        if (gpaMatch) {
          currentEdu.gpa = gpaMatch[0];
        }
      }
      // Look for achievements/bullets
      else if (currentEdu && (line.startsWith('•') || line.startsWith('-') || line.startsWith('*'))) {
        currentEdu.achievements.push(line.replace(/^[•\-*]\s*/, '').trim());
      }
      // Add additional info if it doesn't match other patterns
      else if (currentEdu) {
        if (!currentEdu.location && this.looksLikeLocation(line)) {
          currentEdu.location = line;
        } else if (!currentEdu.field && !currentEdu.degree.includes(line)) {
          currentEdu.field = line;
        }
      }
    }
    
    // Add the last education entry
    if (currentEdu) {
      education.push(currentEdu);
    }
    
    return education;
  }

  looksLikeSchool(line) {
    const schoolKeywords = ['university', 'college', 'school', 'institute', 'academy'];
    return schoolKeywords.some(keyword => line.toLowerCase().includes(keyword)) &&
           !line.toLowerCase().includes('degree') &&
           line.length < 100; // Not too long
  }

  looksLikeDegree(line) {
    const degreeKeywords = [
      'bachelor', 'master', 'phd', 'doctorate', 'associate', 'certificate',
      'b.s.', 'b.a.', 'm.s.', 'm.a.', 'ph.d.', 'bs', 'ba', 'ms', 'ma'
    ];
    return degreeKeywords.some(keyword => line.toLowerCase().includes(keyword)) ||
           line.toLowerCase().includes('degree');
  }

  looksLikeGraduationDate(line) {
    return /graduated|graduation|class of|completed/i.test(line) ||
           /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{4}|\d{4}/i.test(line);
  }

  looksLikeLocation(line) {
    return /[A-Z][a-z]+(?:[\s-][A-Z][a-z]+)*,\s*[A-Z]{2}/.test(line) ||
           /[A-Z][a-z]+(?:[\s-][A-Z][a-z]+)*/.test(line) && line.length < 30;
  }

  /**
   * Parse skills section
   */
  parseSkillsSection(content) {
    const skills = [];
    const lines = content.split('\n').map(line => line.trim()).filter(line => line);
    
    for (const line of lines) {
      // Skills might be comma-separated
      if (line.includes(',')) {
        const skillItems = line.split(',').map(skill => skill.trim()).filter(skill => skill);
        skills.push(...skillItems);
      }
      // Skills might be in bullet points
      else if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
        skills.push(line.replace(/^[•\-*]\s*/, '').trim());
      }
      // Or just listed as separate lines
      else if (line.length < 50) { // Individual skills are usually short
        skills.push(line);
      }
    }
    
    return skills;
  }

  /**
   * Parse certifications section
   */
  parseCertificationsSection(content) {
    const certifications = [];
    const lines = content.split('\n').map(line => line.trim()).filter(line => line);
    
    let currentCert = null;
    
    for (const line of lines) {
      // Certifications often start with a name followed by details
      if (this.looksLikeCertificationName(line)) {
        // Save previous certification if exists
        if (currentCert) {
          certifications.push(currentCert);
        }
        
        // Start new certification
        currentCert = {
          name: line,
          issuer: '',
          date: '',
          details: ''
        };
      }
      // Look for issuers
      else if (currentCert && this.looksLikeIssuer(line)) {
        currentCert.issuer = line;
      }
      // Look for dates
      else if (currentCert && this.looksLikeDate(line)) {
        currentCert.date = line;
      }
      // Additional details
      else if (currentCert) {
        currentCert.details += (currentCert.details ? ' ' : '') + line;
      }
    }
    
    // Add the last certification
    if (currentCert) {
      certifications.push(currentCert);
    }
    
    return certifications;
  }

  looksLikeCertificationName(line) {
    const certKeywords = ['certification', 'certificate', 'certified', 'license', 'credential'];
    return certKeywords.some(keyword => line.toLowerCase().includes(keyword)) ||
           /[A-Z]{2,}/.test(line) || // Has acronyms like "AWS" or "PMP"
           line.length < 60 && !line.includes(','); // Short line that's not a list
  }

  looksLikeIssuer(line) {
    return line.includes('Issuer:') || 
           line.includes('Issued by:') ||
           line.includes('Authority:') ||
           /^[A-Z][a-z]+(?:[\s-][A-Z][a-z]+)*$/.test(line); // Proper noun entity name
  }

  looksLikeDate(line) {
    return /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{4}|\d{1,2}\/\d{4}|\d{4}/i.test(line) &&
           !this.looksLikeCertificationName(line);
  }

  /**
   * Parse projects section
   */
  parseProjectsSection(content) {
    const projects = [];
    const lines = content.split('\n').map(line => line.trim()).filter(line => line);
    
    let currentProject = null;
    let collectingBullets = false;
    
    for (const line of lines) {
      // Projects often start with a name in bold or a line by itself
      if (this.looksLikeProjectName(line)) {
        // Save previous project if exists
        if (currentProject) {
          projects.push(currentProject);
        }
        
        // Start new project
        currentProject = {
          name: line,
          date: '',
          technologies: '',
          details: '',
          bullets: []
        };
        
        collectingBullets = false;
      }
      // Look for dates
      else if (currentProject && this.looksLikeDate(line)) {
        currentProject.date = line;
      }
      // Look for technologies (often comma-separated or prefixed with "Technologies:")
      else if (currentProject && this.looksLikeTechnologies(line)) {
        currentProject.technologies = line.replace(/^Technologies:?\s*/i, '').trim();
      }
      // Look for bullet points
      else if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*') || /^\d+\./.test(line)) {
        if (currentProject) {
          collectingBullets = true;
          currentProject.bullets.push(line.replace(/^[•\-*\d.]\s*/, '').trim());
        }
      }
      // If not a bullet but we're collecting, it could be a continuation
      else if (collectingBullets && currentProject && currentProject.bullets.length > 0) {
        // Append to the last bullet
        currentProject.bullets[currentProject.bullets.length - 1] += ' ' + line;
      }
      // Add to details if nothing else matches
      else if (currentProject && !collectingBullets) {
        currentProject.details += (currentProject.details ? ' ' : '') + line;
      }
    }
    
    // Add the last project
    if (currentProject) {
      projects.push(currentProject);
    }
    
    return projects;
  }

  looksLikeProjectName(line) {
    return (line.includes('Project:') || 
            /^[A-Z][a-zA-Z0-9\s]+$/.test(line) || // Title Case
            line.length < 50 && !line.includes(',')) && // Short line that's not a list
           !this.looksLikeDate(line) &&
           !line.toLowerCase().includes('technologies:');
  }

  looksLikeTechnologies(line) {
    return line.toLowerCase().includes('technologies:') ||
           line.toLowerCase().includes('tech stack:') ||
           line.toLowerCase().includes('tools:') ||
           (line.includes(',') && 
            (line.includes('JavaScript') || 
             line.includes('Python') || 
             line.includes('Java') || 
             line.includes('C++') || 
             line.includes('HTML') || 
             line.includes('React')));
  }
}

// Export the parser
window.ResumeParser = ResumeParser;