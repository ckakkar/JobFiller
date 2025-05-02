/**
 * OpenAI Resume Parser
 * Uses OpenAI's API to extract structured data from resume PDFs
 */

class OpenAIResumeParser {
    constructor(apiKey = null) {
      this.apiKey = apiKey;
      this.apiEndpoint = 'https://api.openai.com/v1/chat/completions';
    }
  
    /**
     * Set the OpenAI API key
     * @param {string} apiKey - OpenAI API key
     */
    setApiKey(apiKey) {
      this.apiKey = apiKey;
    }
  
    /**
     * Parse a PDF file into a structured JSON resume
     * @param {ArrayBuffer} pdfData - The PDF file data as ArrayBuffer
     * @returns {Promise<Object>} - Parsed resume data as JSON
     */
    async parsePDF(pdfData) {
      try {
        // First extract text from PDF using PDF.js (if available) or a text extraction method
        const pdfText = await this.extractTextFromPDF(pdfData);
        
        // Then use OpenAI to parse the text into structured data
        return await this.parseTextWithOpenAI(pdfText);
      } catch (error) {
        console.error('Error parsing PDF with OpenAI:', error);
        throw new Error('Failed to parse PDF: ' + error.message);
      }
    }
  
    /**
     * Extract text from a PDF file
     * @param {ArrayBuffer} pdfData - The PDF file data
     * @returns {Promise<string>} - Extracted text
     */
    async extractTextFromPDF(pdfData) {
      try {
        // Try to use PDF.js if available
        if (window.pdfjsLib) {
          return await this.extractWithPDFJS(pdfData);
        }
        
        // Fallback: Use a simple text extraction or direct upload to OpenAI
        // For this version, we'll assume text extraction happened and proceed with OpenAI
        // This would be replaced with a more robust solution in production
        
        // Convert ArrayBuffer to Base64 for API transmission
        const base64 = this.arrayBufferToBase64(pdfData);
        return base64; // In a real implementation, this would be text
      } catch (error) {
        console.error('Error extracting PDF text:', error);
        throw new Error('Failed to extract text from PDF: ' + error.message);
      }
    }
    
    /**
     * Extract text using PDF.js if available
     * @param {ArrayBuffer} pdfData - The PDF file data
     * @returns {Promise<string>} - Extracted text
     */
    async extractWithPDFJS(pdfData) {
      const pdf = await window.pdfjsLib.getDocument({ data: pdfData }).promise;
      let fullText = '';
      
      // Extract text from all pages
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
      }
      
      return fullText;
    }
    
    /**
     * Convert ArrayBuffer to Base64
     * @param {ArrayBuffer} buffer - The buffer to convert
     * @returns {string} - Base64 encoded string
     */
    arrayBufferToBase64(buffer) {
      let binary = '';
      const bytes = new Uint8Array(buffer);
      const len = bytes.byteLength;
      
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      
      return window.btoa(binary);
    }
  
    /**
     * Parse resume text using OpenAI API
     * @param {string} text - The resume text content
     * @returns {Promise<Object>} - Structured resume data
     */
    async parseTextWithOpenAI(text) {
      if (!this.apiKey) {
        throw new Error('OpenAI API key not set. Please set it in the extension settings.');
      }
      
      try {
        // Chunk the text to handle large PDFs that exceed token limits
        // We'll use a simplified approach - truncate to avoid token limit issues
        // For a more robust solution, we would implement chunking logic
        const maxLength = 6000; // Reduced from original to ensure we stay well under the token limit
        const truncatedText = text.substring(0, maxLength);
        
        // Prepare the API request with better prompting and truncated text
        const response = await fetch(this.apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            model: "gpt-4", // Or use a more appropriate model
            messages: [
              {
                role: "system", 
                content: "You are an expert resume parser. Extract structured information from the resume text and format it as JSON. Include the following sections if found in the resume: personal information (name, email, phone, address, LinkedIn URL, website), summary, experience (company, title, dates, description, location), education (school, degree, field, dates, GPA), skills, certifications, and projects. NOTE: The resume may have been truncated due to length limitations, so please work with the available content."
              },
              {
                role: "user",
                content: `Parse this resume into structured JSON. This may be incomplete due to truncation:\n\n${truncatedText}`
              }
            ],
            temperature: 0.1, // Lower temperature for more consistent results
            max_tokens: 1000 // Reduced to avoid response token limits
          })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          if (result.error && result.error.message) {
            throw new Error(`OpenAI API Error: ${result.error.message}`);
          } else {
            throw new Error(`OpenAI API Error: Unknown error occurred (status ${response.status})`);
          }
        }
        
        // Parse the OpenAI response to extract the JSON
        const content = result.choices[0].message.content;
        
        // Enhanced JSON extraction with multiple fallbacks
        try {
          // First try to parse the whole response as JSON
          return JSON.parse(content);
        } catch (e) {
          console.log("Could not parse entire response as JSON, trying to extract JSON object");
          
          // Try to extract JSON from markdown code blocks
          const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (jsonMatch && jsonMatch[1]) {
            try {
              return JSON.parse(jsonMatch[1]);
            } catch (e2) {
              console.log("Could not parse code block as JSON, trying to find JSON object");
            }
          }
          
          // Try to find JSON object with balanced braces
          try {
            const jsonObjectMatch = this.extractJSONObject(content);
            if (jsonObjectMatch) {
              return JSON.parse(jsonObjectMatch);
            }
          } catch (e3) {
            console.log("Could not extract JSON object with regex");
          }
          
          // Last resort - create a minimal valid resume object
          console.log("Creating fallback minimal resume object");
          return {
            personal: {
              name: "Unknown Name",
              email: "",
              phone: ""
            },
            experience: [],
            education: [],
            skills: []
          };
        }
      } catch (error) {
        console.error('Error calling OpenAI API:', error);
        throw new Error('Failed to parse resume with OpenAI: ' + error.message);
      }
    }
    
    /**
     * Extract JSON object from text by finding balanced braces
     * @param {string} text - Text possibly containing JSON
     * @returns {string|null} - Extracted JSON string or null
     */
    extractJSONObject(text) {
      let openBraces = 0;
      let startIndex = -1;
      
      for (let i = 0; i < text.length; i++) {
        if (text[i] === '{') {
          if (openBraces === 0) startIndex = i;
          openBraces++;
        } else if (text[i] === '}') {
          openBraces--;
          if (openBraces === 0 && startIndex !== -1) {
            return text.substring(startIndex, i + 1);
          }
        }
      }
      
      return null;
    }
  
    /**
     * Parse a resume from JSON file directly
     * @param {string} jsonText - The JSON file content as text
     * @returns {Promise<Object>} - Parsed resume data object
     */
    async parseJSON(jsonText) {
      try {
        // Parse JSON directly
        return JSON.parse(jsonText);
      } catch (error) {
        console.error('Error parsing JSON resume:', error);
        throw new Error('Invalid JSON format: ' + error.message);
      }
    }
}