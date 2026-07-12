function getCurrentSlug() {
  const pathname = window.location.pathname.replace(/\/index\.html$/, '/');
  const cleaned = pathname.replace(/\/+$/, '');
  const parts = cleaned.split('/').filter(Boolean);
  return parts[parts.length - 1] || 'insights';
}

function getInsightHref(slug) {
  const path = window.location.pathname;
  const isLandingPage = path === '/insights/' || path === '/insights';
  if (isLandingPage) {
    return `./${slug}/`;
  }
  return `../${slug}/`;
}

function getArticleBySlug(slug) {
  return insightsArticles.find(article => article.slug === slug) || null;
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatInlineMarkdown(text) {
  let html = String(text);
  const preserved = [];
  html = html.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, match => {
    const token = `__PRESERVED_LINK_${preserved.length}__`;
    preserved.push(match);
    return token;
  });
  html = escapeHtml(html);
  html = html.replace(/__PRESERVED_LINK_(\d+)__/g, (_, index) => preserved[Number(index)] || '');
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<figure class="article-figure"><img src="$2" alt="$1" loading="lazy" decoding="async"></figure>');
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  return html;
}

function addInternalLinks(text, currentArticle) {
  if (!text) return text;

  const linkMap = [
    { phrase: 'wikipedia notability', slug: 'what-is-wikipedia-notability', label: 'Wikipedia Notability' },
    { phrase: 'reliable sources', slug: 'how-wikipedia-evaluates-reliable-sources', label: 'Reliable Sources' },
    { phrase: 'wikipedia consultant', slug: 'wikipedia-consultant-what-they-do-why-they-matter-and-how-to-choose-one-responsibly', label: 'Wikipedia Consultant' },
    { phrase: 'neutral writing', slug: 'why-neutral-writing-matters', label: 'Neutral Writing' },
    { phrase: 'independent coverage', slug: 'understanding-independent-coverage', label: 'Independent Coverage' },
    { phrase: 'marketing platform', slug: 'wikipedia-is-not-a-marketing-platform', label: 'Marketing Platform' },
    { phrase: 'readiness assessment', slug: 'preparing-for-a-wikipedia-readiness-assessment', label: 'Readiness Assessment' },
    { phrase: 'promotion and documentation', slug: 'the-difference-between-promotion-and-documentation', label: 'Promotion and Documentation' },
    { phrase: 'common misconceptions', slug: 'common-misconceptions-about-wikipedia', label: 'Common Misconceptions' }
  ];

  let output = text;
  const replacements = [];
  linkMap.forEach(({ phrase, slug, label }) => {
    if (slug === currentArticle.slug) return;
    const pattern = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    output = output.replace(pattern, match => {
      const token = `__INTERNAL_LINK_${replacements.length}__`;
      replacements.push(`<a href="${getInsightHref(slug)}">${label}</a>`);
      return token;
    });
  });

  return replacements.reduce((result, replacement, index) => result.replace(`__INTERNAL_LINK_${index}__`, replacement), output);
}

function estimateReadingTime(text) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(3, Math.ceil(words / 190));
  return `${minutes} min read`;
}

function renderMarkdownContent(markdown, article) {
  const source = addInternalLinks(markdown, article);
  const lines = source.split(/\r?\n/);
  let html = '';
  let paragraphLines = [];
  let listItems = [];
  let orderedItems = [];
  let tableRows = [];
  let codeBuffer = [];
  let inCodeBlock = false;
  let codeLanguage = '';

  const flushParagraph = () => {
    if (paragraphLines.length) {
      html += `<p>${formatInlineMarkdown(paragraphLines.join(' '))}</p>`;
      paragraphLines = [];
    }
  };

  const flushList = () => {
    if (listItems.length) {
      html += `<ul>${listItems.map(item => `<li>${formatInlineMarkdown(item)}</li>`).join('')}</ul>`;
      listItems = [];
    }
    if (orderedItems.length) {
      html += `<ol>${orderedItems.map(item => `<li>${formatInlineMarkdown(item)}</li>`).join('')}</ol>`;
      orderedItems = [];
    }
  };

  const flushTable = () => {
    if (!tableRows.length) return;
    const rows = tableRows.map(row => row.split('|').map(cell => cell.trim()).filter((cell, index, arr) => index !== 0 && index !== arr.length - 1));
    const head = rows[0];
    const body = rows.slice(1);
    html += `<table><thead><tr>${head.map(cell => `<th>${formatInlineMarkdown(cell)}</th>`).join('')}</tr></thead><tbody>${body.map(row => `<tr>${row.map(cell => `<td>${formatInlineMarkdown(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    tableRows = [];
  };

  lines.forEach(line => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      return;
    }

    if (/^```/.test(trimmed)) {
      flushParagraph();
      flushList();
      flushTable();
      if (inCodeBlock) {
        html += `<pre><code class="language-${codeLanguage}">${escapeHtml(codeBuffer.join('\n'))}</code></pre>`;
        codeBuffer = [];
        codeLanguage = '';
        inCodeBlock = false;
      } else {
        codeLanguage = trimmed.replace(/```/, '').trim();
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      return;
    }

    if (/^#{1,3}\s+/.test(trimmed)) {
      flushParagraph();
      flushList();
      const level = trimmed.match(/^#+/)[0].length;
      const headingText = trimmed.replace(/^#{1,3}\s+/, '');
      const tag = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3';
      html += `<${tag}>${formatInlineMarkdown(headingText)}</${tag}>`;
      return;
    }

    if (/^>\s*\[!(NOTE|WARNING|TIP|QUOTE)\]/i.test(trimmed)) {
      flushParagraph();
      flushList();
      const kind = (trimmed.match(/^>\s*\[!(NOTE|WARNING|TIP|QUOTE)\]/i) || ['note'])[1].toLowerCase();
      const content = trimmed.replace(/^>\s*\[!(NOTE|WARNING|TIP|QUOTE)\]\s*/i, '');
      html += `<blockquote class="article-callout ${kind}">${formatInlineMarkdown(content)}</blockquote>`;
      return;
    }

    if (/^>\s+/.test(trimmed)) {
      flushParagraph();
      flushList();
      html += `<blockquote>${formatInlineMarkdown(trimmed.replace(/^>\s*/, ''))}</blockquote>`;
      return;
    }

    if (/^\|/.test(trimmed) && trimmed.includes('|')) {
      flushParagraph();
      flushList();
      tableRows.push(trimmed);
      return;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      flushParagraph();
      listItems.push(trimmed.replace(/^[-*]\s+/, ''));
      return;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      flushParagraph();
      orderedItems.push(trimmed.replace(/^\d+\.\s+/, ''));
      return;
    }

    if (/^---$/.test(trimmed)) {
      flushParagraph();
      flushList();
      html += '<hr class="article-divider">';
      return;
    }

    paragraphLines.push(trimmed);
  });

  flushParagraph();
  flushList();
  flushTable();

  if (inCodeBlock) {
    html += `<pre><code class="language-${codeLanguage}">${escapeHtml(codeBuffer.join('\n'))}</code></pre>`;
  }

  return html;
}

function renderInsightsLanding() {
  const grid = document.getElementById('insightGrid');
  const searchInput = document.getElementById('insightSearch');
  const filterGroup = document.getElementById('categoryFilters');

  if (!grid) return;

  let activeCategory = 'All';
  let searchTerm = '';

  function renderCards() {
    const normalized = searchTerm.trim().toLowerCase();
    const filtered = insightsArticles.filter(article => {
      const matchesCategory = activeCategory === 'All' || article.category === activeCategory;
      const haystack = `${article.title} ${article.description} ${article.category} ${article.tags.join(' ')} ${article.body || ''}`.toLowerCase();
      const matchesSearch = !normalized || haystack.includes(normalized);
      return matchesCategory && matchesSearch;
    });

    if (!filtered.length) {
      grid.innerHTML = '<div class="insights-panel"><h3>No insights match that search.</h3><p>Try a broader keyword or switch category.</p></div>';
      return;
    }

    grid.innerHTML = filtered.map(article => `
      <article class="insight-card">
        <img src="${article.image}" alt="${article.title}" loading="lazy">
        <div class="insight-card-body">
          <div class="insight-meta">
            <span>${article.category}</span>
            <span>${article.readingTime || estimateReadingTime(article.body || article.content || '')}</span>
          </div>
          <h3>${article.title}</h3>
          <p>${article.description}</p>
          <div class="insight-card-footer">
            <span>${formatDate(article.date)}</span>
            <a class="btn btn-secondary" href="${getInsightHref(article.slug)}">Read More</a>
          </div>
        </div>
      </article>
    `).join('');
  }

  filterGroup.innerHTML = insightCategories.map(category => `
    <button class="filter-pill ${category === 'All' ? 'active' : ''}" type="button" data-category="${category}">${category}</button>
  `).join('');

  filterGroup.querySelectorAll('.filter-pill').forEach(button => {
    button.addEventListener('click', () => {
      activeCategory = button.dataset.category;
      filterGroup.querySelectorAll('.filter-pill').forEach(item => item.classList.toggle('active', item === button));
      renderCards();
    });
  });

  if (searchInput) {
    searchInput.addEventListener('input', (event) => {
      searchTerm = event.target.value;
      renderCards();
    });
  }

  renderCards();
}

function renderArticlePage() {
  const article = getArticleBySlug(getCurrentSlug());
  if (!article) return;

  const contentTarget = document.getElementById('articleContent');
  const titleTarget = document.getElementById('articleTitle');
  const badgeTarget = document.getElementById('articleBadge');
  const metaTarget = document.getElementById('articleMeta');
  const heroImageTarget = document.getElementById('articleHeroImage');
  const relatedTarget = document.getElementById('relatedArticles');
  const tocTarget = document.getElementById('toc');
  const viewCountTarget = document.getElementById('viewCount');

  if (titleTarget) titleTarget.textContent = article.title;
  if (badgeTarget) badgeTarget.textContent = article.category;
  if (metaTarget) {
    metaTarget.innerHTML = `
      <span>By ${article.author}</span>
      <span>${formatDate(article.date)}</span>
      <span>${article.readingTime || estimateReadingTime(article.body || article.content || '')}</span>
    `;
  }
  if (heroImageTarget) heroImageTarget.src = article.image;
  if (heroImageTarget) heroImageTarget.alt = article.title;
  if (contentTarget) contentTarget.innerHTML = renderMarkdownContent(article.body || article.content || '', article);

  injectArticleMetadata(article);
  updateMetadata(article);
  buildTableOfContents(tocTarget);
  renderRelatedArticles(relatedTarget, article);
  renderArticleNavigation(article);
  updateViewCount(article.slug, viewCountTarget);
  initShareButtons(article);
  initReadingProgress();
  initCopyLinkButton(article);
  initBackToTop();
}

function injectArticleMetadata(article) {
  const hero = document.querySelector('.article-hero');
  if (!hero) return;

  const existing = hero.querySelector('.article-hero-meta');
  if (existing) existing.remove();

  const bodySource = article.body || article.content || '';
  const readingTime = article.readingTime || estimateReadingTime(bodySource);

  const details = document.createElement('div');
  details.className = 'article-hero-meta';
  details.innerHTML = `
    <div class="article-meta-stack">
      <span class="article-reading-time">Estimated reading time: ${readingTime}</span>
      <span class="article-updated">Last updated ${formatDate(article.updatedDate || article.date)}</span>
    </div>
    ${article.excerpt ? `<p class="article-excerpt">${article.excerpt}</p>` : ''}
  `;
  hero.appendChild(details);
}

function updateMetadata(article) {
  document.title = `${article.seoTitle} | NotablePath Insights`;
  const metaDescription = document.querySelector('meta[name="description"]');
  const canonical = document.querySelector('link[rel="canonical"]');
  const ogTitle = document.querySelector('meta[property="og:title"]');
  const ogDescription = document.querySelector('meta[property="og:description"]');
  const ogImage = document.querySelector('meta[property="og:image"]');
  const twitterTitle = document.querySelector('meta[name="twitter:title"]');
  const twitterDescription = document.querySelector('meta[name="twitter:description"]');
  const twitterImage = document.querySelector('meta[name="twitter:image"]');

  if (metaDescription) metaDescription.setAttribute('content', article.seoDescription);
  if (canonical) canonical.setAttribute('href', `https://notablepath.com/insights/${article.slug}/`);
  if (ogTitle) ogTitle.setAttribute('content', article.seoTitle);
  if (ogDescription) ogDescription.setAttribute('content', article.seoDescription);
  if (ogImage) ogImage.setAttribute('content', article.ogImage);
  if (twitterTitle) twitterTitle.setAttribute('content', article.seoTitle);
  if (twitterDescription) twitterDescription.setAttribute('content', article.seoDescription);
  if (twitterImage) twitterImage.setAttribute('content', article.ogImage);

  const schemaTarget = document.getElementById('articleSchema');
  if (schemaTarget) {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: article.title,
      description: article.seoDescription,
      image: article.image,
      datePublished: article.date,
      dateModified: article.updatedDate || article.date,
      author: {
        '@type': 'Organization',
        name: article.author,
        url: 'https://notablepath.com'
      },
      publisher: {
        '@type': 'Organization',
        name: 'NotablePath',
        url: 'https://notablepath.com'
      },
      mainEntityOfPage: `https://notablepath.com/insights/${article.slug}/`,
      keywords: article.keywords.join(', ')
    };
    schemaTarget.textContent = JSON.stringify(schema);
  }

  const breadcrumbTarget = document.getElementById('breadcrumbSchema');
  if (breadcrumbTarget) {
    const breadcrumbSchema = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: 'https://notablepath.com/'
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Insights',
          item: 'https://notablepath.com/insights/'
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: article.title,
          item: `https://notablepath.com/insights/${article.slug}/`
        }
      ]
    };
    breadcrumbTarget.textContent = JSON.stringify(breadcrumbSchema);
  }
}

function buildTableOfContents(target) {
  if (!target) return;
  const headings = Array.from(document.querySelectorAll('#articleContent h2, #articleContent h3'));
  if (!headings.length) {
    target.innerHTML = '<p>No sections available yet.</p>';
    return;
  }

  const list = document.createElement('ul');
  headings.forEach((heading, index) => {
    heading.id = heading.id || `section-${index + 1}`;
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = `#${heading.id}`;
    link.textContent = heading.textContent;
    item.appendChild(link);
    list.appendChild(item);
  });

  target.innerHTML = '';
  target.appendChild(list);
  initTableOfContentsHighlight();
}

function initTableOfContentsHighlight() {
  const links = Array.from(document.querySelectorAll('.article-toc a[href^="#"]'));
  if (!links.length) return;

  const headings = links
    .map(link => document.getElementById(link.getAttribute('href').slice(1)))
    .filter(Boolean);

  if (!headings.length) return;

  const setActive = (activeId) => {
    links.forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === `#${activeId}`);
    });
  };

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      const visibleEntry = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visibleEntry) {
        setActive(visibleEntry.target.id);
      }
    }, {
      rootMargin: '-20% 0px -60% 0px',
      threshold: [0.1, 0.3, 0.6]
    });

    headings.forEach(heading => observer.observe(heading));
    setActive(headings[0].id);
    return;
  }

  const updateActive = () => {
    let activeId = headings[0].id;
    headings.forEach(heading => {
      if (window.scrollY + 140 >= heading.offsetTop) {
        activeId = heading.id;
      }
    });
    setActive(activeId);
  };

  updateActive();
  window.addEventListener('scroll', updateActive, { passive: true });
}

function renderRelatedArticles(target, article) {
  if (!target) return;
  const related = insightsArticles.filter(candidate => candidate.slug !== article.slug && candidate.category === article.category).slice(0, 3);
  target.innerHTML = related.map(item => `
    <div class="insight-card">
      <div class="insight-card-body">
        <div class="insight-meta"><span>${item.category}</span><span>${item.readingTime || estimateReadingTime(item.body || item.content || '')}</span></div>
        <h3>${item.title}</h3>
        <p>${item.description}</p>
        <a class="btn btn-secondary" href="${getInsightHref(item.slug)}">Read article</a>
      </div>
    </div>
  `).join('');
}

function renderArticleNavigation(article) {
  const target = document.getElementById('articleNavigation');
  if (!target) return;
  const index = insightsArticles.findIndex(item => item.slug === article.slug);
  const previous = insightsArticles[index - 1];
  const next = insightsArticles[index + 1];

  target.innerHTML = `
    ${previous ? `<a href="${getInsightHref(previous.slug)}">← Previous article</a>` : '<span></span>'}
    ${next ? `<a href="${getInsightHref(next.slug)}">Next article →</a>` : '<span></span>'}
  `;
}

async function updateViewCount(slug, target) {
  if (!target) return;
  const key = `insight-view-${slug}`;
  const current = Number(localStorage.getItem(key) || 0);
  localStorage.setItem(key, current + 1);

  try {
    const response = await fetch(`https://api.countapi.xyz/hit/notablepath-insights/${slug}`);
    const result = await response.json();
    target.textContent = `Viewed ${result.value.toLocaleString()} times`;
  } catch (error) {
    const fallback = Number(localStorage.getItem(key) || 0);
    target.textContent = `Viewed ${fallback.toLocaleString()} times`;
  }
}

function initShareButtons(article) {
  const shareButtons = document.querySelectorAll('[data-share]');
  const shareUrl = `https://notablepath.com/insights/${article.slug}/`;

  shareButtons.forEach(button => {
    button.addEventListener('click', async () => {
      const shareText = `${article.title} by NotablePath Insights`;
      if (navigator.share) {
        try {
          await navigator.share({ title: article.title, text: shareText, url: shareUrl });
        } catch (error) {
          // ignore
        }
      } else {
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
      }
    });
  });
}

function initCopyLinkButton(article) {
  const shareRow = document.querySelector('.share-row');
  if (!shareRow) return;
  if (shareRow.querySelector('[data-copy-link]')) return;

  const button = document.createElement('button');
  button.className = 'btn btn-secondary icon-button';
  button.setAttribute('data-copy-link', 'true');
  button.setAttribute('type', 'button');
  button.setAttribute('aria-label', 'Copy article link');
  button.innerHTML = '⧉';
  button.title = 'Copy link';
  button.addEventListener('click', async () => {
    const shareUrl = `https://notablepath.com/insights/${article.slug}/`;
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl);
      button.innerHTML = '✓';
      button.title = 'Copied';
      setTimeout(() => {
        button.innerHTML = '⧉';
        button.title = 'Copy link';
      }, 1600);
    }
  });
  shareRow.appendChild(button);
}

function initBackToTop() {
  let button = document.querySelector('.back-to-top');
  if (!button) {
    button = document.createElement('button');
    button.className = 'back-to-top';
    button.setAttribute('type', 'button');
    button.innerHTML = '↑';
    document.body.appendChild(button);
  }

  const toggle = () => {
    button.classList.toggle('visible', window.scrollY > 500);
  };

  button.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  toggle();
  window.addEventListener('scroll', toggle, { passive: true });
}

function initReadingProgress() {
  const bar = document.getElementById('readingProgress');
  if (!bar) return;

  const update = () => {
    const scrollTop = window.scrollY;
    const height = document.documentElement.scrollHeight - window.innerHeight;
    const progress = height > 0 ? (scrollTop / height) * 100 : 0;
    bar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
  };

  update();
  window.addEventListener('scroll', update, { passive: true });
}

function initInsightsPage() {
  renderInsightsLanding();
  renderArticlePage();
}

document.addEventListener('DOMContentLoaded', initInsightsPage);
