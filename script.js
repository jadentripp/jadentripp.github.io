function loadSummary(title1, title2) {
    const fixedTooltip = document.getElementById('fixed-tooltip');
    const contentDiv = document.getElementById('tooltip-content');
    fixedTooltip.style.display = 'block'; // Reset display property
    contentDiv.innerText = 'Loading summaries...';

    if (title2) {
        fetchWikiSummary(title1)
            .then(summary1 => {
                return fetchWikiSummary(title2)
                    .then(summary2 => {
                        contentDiv.innerText = `Book: ${summary1}\n\nAuthor: ${summary2}`;
                    });
            });
    } else {
        fetchWikiSummary(title1)
            .then(summary => {
                contentDiv.innerText = summary;
            });
    }
}

function fetchWikiSummary(title) {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`;
    return fetch(url)
        .then(response => response.json())
        .then(data => data.extract);
}

function closeTooltip() {
    const tooltip = document.getElementById('fixed-tooltip');
    tooltip.style.display = 'none';
}
