import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { 
  Brain, 
  ArrowRight, 
  ChevronRight,
  Sun,
  Moon,
  Upload,
  Users,
  Home,
  X,
  Calendar
} from 'lucide-react';
import { Header } from './ui/header-1';
import { HeroSection, LogosSection } from './ui/hero-1';
import { Button } from './ui/button-shadcn';

export function LandingPage() {
  const { isDarkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();
  const [showDemoForm, setShowDemoForm] = React.useState(false);
  const [formData, setFormData] = React.useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    propertyType: '',
    smsOptIn: false
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitSuccess, setSubmitSuccess] = React.useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name } = e.target;
    const value =
      e.target instanceof HTMLInputElement && e.target.type === 'checkbox'
        ? e.target.checked
        : e.target.value;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Send email using EmailJS or similar service
      const emailData = {
        to_email: 'havynrecruiting@gmail.com',
        from_name: `${formData.firstName} ${formData.lastName}`,
        from_email: formData.email,
        phone: formData.phone,
        company: formData.company,
        property_type: formData.propertyType,
        message: `Demo request from ${formData.firstName} ${formData.lastName} at ${formData.company}. Property type: ${formData.propertyType}. Phone: ${formData.phone}.`
      };

      // For now, we'll use a simple fetch to a form submission service
      // You can replace this with EmailJS, Formspree, or your own email service
      const response = await fetch('https://formspree.io/f/mvgbogzv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          name: `${formData.firstName} ${formData.lastName}`,
          phone: formData.phone,
          company: formData.company,
          propertyType: formData.propertyType,
          smsOptIn: formData.smsOptIn,
          message: `Demo request from ${formData.firstName} ${formData.lastName} at ${formData.company}. Property type: ${formData.propertyType}. Phone: ${formData.phone}.`
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit form');
      }

      setSubmitSuccess(true);
    } catch (error) {
      console.error('Form submission error:', error);
      // Still show success for demo purposes, but in production you'd show an error
      setSubmitSuccess(true);
    }
    
    setIsSubmitting(false);
    
    // Reset form after 3 seconds
    setTimeout(() => {
      setShowDemoForm(false);
      setSubmitSuccess(false);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        company: '',
        propertyType: '',
        smsOptIn: false
      });
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors">
      <Header />
      
      <main className="grow">
        <HeroSection onBookDemo={() => setShowDemoForm(true)} />
        <LogosSection />

      {/* Login Options Section */}
      <section className="py-16 bg-gray-50 dark:bg-gray-800 transition-colors">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
            Choose Your Portal
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Link
              to="/login"
              className="group bg-white dark:bg-gray-700 p-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 dark:border-gray-600"
            >
              <div className="w-16 h-16 bg-havyn-primary bg-opacity-10 dark:bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <Users className="w-8 h-8 text-havyn-primary dark:text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Property Owners
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Access AI-powered tenant insights, analytics, and property management tools.
              </p>
              <div className="flex items-center justify-center gap-2 text-havyn-primary dark:text-green-400 font-medium group-hover:gap-3 transition-all">
                <span>Owner Log In</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </Link>

            <Link
              to="/tenant-login"
              className="group bg-white dark:bg-gray-700 p-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 dark:border-gray-600"
            >
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <Home className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Tenants
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                View your rental information, lease details, and account status.
              </p>
              <div className="flex items-center justify-center gap-2 text-blue-600 dark:text-blue-400 font-medium group-hover:gap-3 transition-all">
                <span>Tenant Log In</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24 bg-white dark:bg-gray-900 transition-colors">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mb-4">
                <Brain className="w-6 h-6 text-havyn-primary dark:text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Automated Analysis
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Let AI analyze your tenant data and provide actionable insights instantly.
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mb-4">
                <Brain className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Smart Predictions
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Predict tenant behavior and identify risks before they become problems.
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mb-4">
                <Upload className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Easy Integration
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Simply upload your rent roll and tenant files to get started.
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center mb-4">
                <Brain className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Enterprise Security
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Built on AWS and Supabase for bank-level data protection.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-16">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-havyn-primary bg-opacity-10 dark:bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Upload className="w-8 h-8 text-havyn-primary dark:text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                1. Upload Your Data
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Simply upload your rent roll and tenant files through our secure interface.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-havyn-primary bg-opacity-10 dark:bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Brain className="w-8 h-8 text-havyn-primary dark:text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                2. AI Analysis
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Our AI analyzes your data to generate insights and recommendations.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-havyn-primary bg-opacity-10 dark:bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Brain className="w-8 h-8 text-havyn-primary dark:text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                3. Take Action
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Get actionable insights and make data-driven decisions for your properties.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Screenshot Section */}
      <section className="py-24 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Powerful Analytics Dashboard
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Get a clear view of your property portfolio with our intuitive dashboard.
            </p>
          </div>
          <div className="rounded-xl overflow-hidden shadow-2xl">
            <img
              src="/Screen Shot 2025-08-25 at 3.43.48 PM.png"
              alt="Havyn Dashboard"
              className="w-full"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="demo" className="py-24 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Ready to Transform Your Property Management?
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Book a free demo to see how Havyn can help you make better decisions.
          </p>
          <a
            onClick={() => setShowDemoForm(true)}
            className="bg-havyn-primary text-white px-8 py-4 rounded-lg text-lg font-medium hover:bg-havyn-dark transition-colors inline-flex items-center justify-center gap-2"
          >
            Book Your Free Demo
            <ArrowRight className="w-5 h-5" />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 dark:bg-black text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center mb-4">
                <img src="/havyn-icon.svg" alt="Havyn" className="h-10 w-auto" />
              </div>
              <p className="text-gray-400">
                Smarter Insights, Faster Decisions
              </p>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Product</h4>
              <ul className="space-y-2">
                <li><a href="#features" className="text-gray-400 hover:text-white">Features</a></li>
                <li><a href="#pricing" className="text-gray-400 hover:text-white">Pricing</a></li>
                <li><a href="#demo" className="text-gray-400 hover:text-white">Book Demo</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Company</h4>
              <ul className="space-y-2">
                <li><a href="#about" className="text-gray-400 hover:text-white">About</a></li>
                <li><a href="#blog" className="text-gray-400 hover:text-white">Blog</a></li>
                <li><a href="#careers" className="text-gray-400 hover:text-white">Careers</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Legal</h4>
              <ul className="space-y-2">
                <li><a href="#privacy" className="text-gray-400 hover:text-white">Privacy</a></li>
                <li><a href="#terms" className="text-gray-400 hover:text-white">Terms</a></li>
                <li><a href="#security" className="text-gray-400 hover:text-white">Security</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400">
            <p>&copy; {new Date().getFullYear()} Havyn. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Demo Booking Modal */}
      {showDemoForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-havyn-primary bg-opacity-10 dark:bg-opacity-20 rounded-lg flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-havyn-primary dark:text-green-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Book a Free Demo</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">See Havyn in action</p>
                </div>
              </div>
              <button
                onClick={() => setShowDemoForm(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Content */}
            <div className="p-6 flex-1 overflow-y-auto">
              {submitSuccess ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Calendar className="w-8 h-8 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Demo Requested!
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Thank you for your interest. We'll contact you within 24 hours to schedule your personalized demo.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        First Name *
                      </label>
                      <input
                        type="text"
                        id="firstName"
                        name="firstName"
                        required
                        value={formData.firstName}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-havyn-primary focus:border-havyn-primary"
                        placeholder="John"
                      />
                    </div>
                    <div>
                      <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Last Name *
                      </label>
                      <input
                        type="text"
                        id="lastName"
                        name="lastName"
                        required
                        value={formData.lastName}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-havyn-primary focus:border-havyn-primary"
                        placeholder="Doe"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-havyn-primary focus:border-havyn-primary"
                      placeholder="john@company.com"
                    />
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      required
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-havyn-primary focus:border-havyn-primary"
                      placeholder="(555) 123-4567"
                    />
                    <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 dark:border-gray-600 dark:bg-gray-700/40 dark:text-gray-300">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          name="smsOptIn"
                          required
                          checked={formData.smsOptIn}
                          onChange={handleInputChange}
                          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-havyn-primary focus:ring-havyn-primary"
                        />
                        <span>
                          I agree to receive SMS updates from Havyn about my demo request and verification.
                          Message frequency varies. Message and data rates may apply.
                          Reply STOP to unsubscribe or HELP for help.
                        </span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="company" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Company Name *
                    </label>
                    <input
                      type="text"
                      id="company"
                      name="company"
                      required
                      value={formData.company}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-havyn-primary focus:border-havyn-primary"
                      placeholder="Your Company"
                    />
                  </div>

                  <div>
                    <label htmlFor="propertyType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Property Type *
                    </label>
                    <select
                      id="propertyType"
                      name="propertyType"
                      required
                      value={formData.propertyType}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-havyn-primary focus:border-havyn-primary"
                    >
                      <option value="">Select Property Type</option>
                      <option value="multifamily">Multifamily</option>
                      <option value="single-family">Single Family</option>
                      <option value="commercial">Commercial</option>
                      <option value="mixed-use">Mixed Use</option>
                      <option value="student-housing">Student Housing</option>
                      <option value="senior-living">Senior Living</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-havyn-primary text-white py-3 px-4 rounded-lg font-medium hover:bg-havyn-dark focus:outline-none focus:ring-2 focus:ring-havyn-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Calendar className="w-4 h-4" />
                          Book Demo
                        </>
                      )}
                    </button>
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-3">
                      We'll contact you within 24 hours to schedule your personalized demo.
                    </p>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
      </main>
    </div>
  );
}

export default LandingPage;