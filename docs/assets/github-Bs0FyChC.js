import{a as e,d as t,f as n,h as r,l as i,m as a,o,p as s,u as c}from"./uiLifecycle-1q_F6EZb.js";var l={JavaScript:`#f1e05a`,TypeScript:`#3178c6`,Python:`#3572A5`,Java:`#b07219`,Go:`#00ADD8`,Rust:`#dea584`,Ruby:`#701516`,"C++":`#f34b7d`,C:`#555555`,"C#":`#178600`,PHP:`#4F5D95`,Swift:`#F05138`,Kotlin:`#A97BFF`,Dart:`#00B4AB`,Shell:`#89e051`,HTML:`#e34c26`,CSS:`#563d7c`,Vue:`#41b883`,Svelte:`#ff3e00`,Lua:`#000080`,Zig:`#ec915c`,Elixir:`#6e4a7e`,Haskell:`#5e5086`};function u(e,t){return t>0?(e/t).toFixed(1):e>0?`∞`:`0`}async function d(e,t){let n=o(void 0,t),r=`/users/${encodeURIComponent(e)}`,i=await n.request(r),a=await n.paginate(`${r}/repos?sort=full_name&direction=asc`,e=>e.html_url);a.sort((e,t)=>t.stargazers_count-e.stargazers_count);let s=a.reduce((e,t)=>e+t.stargazers_count,0),c={},d=0;for(let e of a)e.archived||e.fork||!e.language||(c[e.language]??={count:0,color:l[e.language]||`#8b949e`},c[e.language].count++,d++);return{user:i,repos:a,totalStars:s,topLanguages:Object.entries(c).map(([e,{count:t,color:n}])=>({name:e,count:t,color:n,percentage:d>0?t/d*100:0})).sort((e,t)=>t.count-e.count).slice(0,8),originalRepos:a.filter(e=>!e.fork&&!e.archived).length,forkedRepos:a.filter(e=>e.fork).length,totalForksReceived:a.reduce((e,t)=>e+t.forks_count,0),languageCount:Object.keys(c).length,accountAge:new Date().getFullYear()-new Date(i.created_at).getFullYear(),followerRatio:u(i.followers,i.following)}}var f=`
  query ProfileInsights($username: String!, $after: String) {
    user(login: $username) {
      name login createdAt avatarUrl
      followers { totalCount }
      following { totalCount }
      repositories(first: 100, after: $after, ownerAffiliations: OWNER, orderBy: {field: STARGAZERS, direction: DESC}) {
        totalCount
        pageInfo { hasNextPage endCursor }
        nodes {
          id name url stargazerCount forkCount
          primaryLanguage { name color }
          createdAt updatedAt isArchived isFork
        }
      }
      pullRequests(states: MERGED, first: 1) { totalCount }
      openPRs: pullRequests(states: OPEN, first: 1) { totalCount }
      closedPRs: pullRequests(states: CLOSED, first: 1) { totalCount }
      closedIssues: issues(states: CLOSED, first: 1) { totalCount }
      openIssues: issues(states: OPEN, first: 1) { totalCount }
      repositoriesContributedTo(first: 1, contributionTypes: [COMMIT, PULL_REQUEST, ISSUE]) { totalCount }
      organizations { totalCount }
    }
  }
`,p=`
  query ContributionWindow($username: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $username) {
      contributionsCollection(from: $from, to: $to) {
        totalCommitContributions
        totalPullRequestContributions
        totalPullRequestReviewContributions
        totalIssueContributions
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays { contributionCount date weekday }
          }
        }
      }
    }
  }
`;function m(t){throw new e(`GitHub returned incomplete ${t}. Please refresh.`,`invalid-response`)}function h(e,t){for(let n of Object.keys(e))(!Number.isFinite(t[n])||t[n]<0)&&m(`contribution totals`),e[n]+=t[n]}function g(e,t,n){return e.date<t||e.date>n?null:((!Number.isInteger(e.contributionCount)||e.contributionCount<0)&&m(`contribution calendar`),e)}function _(e,t,n,r){let i=new Map;for(let a of e){Array.isArray(a.contributionDays)||m(`contribution calendar`);for(let e of a.contributionDays){let a=g(e,t,n);if(!a)continue;let o=i.get(a.date)??r.get(a.date);o&&o.contributionCount!==a.contributionCount&&m(`contribution calendar`),i.set(a.date,a)}}return i}function v(e,t,n,r,i){for(let a=n;a<=r;a+=i){let n=new Date(a).toISOString().slice(0,10),r=t.get(n);r||m(`contribution calendar`),e.set(n,r)}}async function y(e,t,n){let r=864e5,i=Date.parse(n.toISOString().slice(0,10))-364*r,a=new Map,o={totalCommitContributions:0,totalPullRequestContributions:0,totalPullRequestReviewContributions:0,totalIssueContributions:0};for(let s=0;s<365;s+=92){let c=i+s*r,l=Math.min(i+(s+92)*r-1,n.getTime()),u=new Date(c).toISOString(),d=new Date(l).toISOString(),f=(await t.graphql(p,{username:e,from:u,to:d})).user?.contributionsCollection;f?.contributionCalendar?.weeks||m(`contribution data`),h(o,f),v(a,_(f.contributionCalendar.weeks,u.slice(0,10),d.slice(0,10),a),c,l,r)}let s=[...a.values()].sort((e,t)=>e.date.localeCompare(t.date));return{...o,contributionCalendar:{totalContributions:s.reduce((e,t)=>e+t.contributionCount,0),weeks:[{contributionDays:s}]}}}async function b(e,t,n){let r=new Map,i=new Set,a=n;for(;;){(!a?.pageInfo||!Array.isArray(a.nodes))&&m(`repository data`);for(let e of a.nodes)e?.id||m(`repository data`),r.set(e.id,e);if(!a.pageInfo.hasNextPage)break;let n=a.pageInfo.endCursor;(!n||i.has(n))&&m(`repository pagination`),i.add(n);let o=await t.graphql(f,{username:e,after:n});o.user||m(`repository data`),a=o.user.repositories}return r}function x(e){let t={},n=0;for(let r of e){if(r.isArchived||r.isFork||!r.primaryLanguage)continue;let{name:e,color:i}=r.primaryLanguage;t[e]??={count:0,color:i??l[e]??`#8b949e`},t[e].count++,n++}return{topLanguages:Object.entries(t).map(([e,{count:t,color:r}])=>({name:e,count:t,color:r,percentage:n>0?t/n*100:0})).sort((e,t)=>t.count-e.count).slice(0,8),languageCount:Object.keys(t).length}}async function S(e,t,n){return C(e,o(t,n))}async function C(o,l){let d=new Date,p=await l.graphql(f,{username:o,after:null});if(!p.user)throw new e(`User "${o}" not found`,`not-found`,404);let h=p.user,g=await b(o,l,h.repositories);g.size!==h.repositories.totalCount&&m(`repository pagination`),h.repositories.nodes=[...g.values()];let _=await y(o,l,d),v=_.contributionCalendar,S=h.repositories.nodes.reduce((e,t)=>e+t.stargazerCount,0),{topLanguages:C,languageCount:w}=x(h.repositories.nodes),T=h.repositories.nodes,E=T.filter(e=>!e.isFork&&!e.isArchived).length,D=T.filter(e=>e.isFork).length,O=T.reduce((e,t)=>e+t.forkCount,0),k=new Date().getFullYear()-new Date(h.createdAt).getFullYear(),A=h.followers.totalCount,j=h.following?.totalCount??0,M=u(A,j),N=s(v,d),P=n(_.totalCommitContributions,_.totalPullRequestContributions,_.totalPullRequestReviewContributions,_.totalIssueContributions),F=a(v,d),I=i(v),L=r(v),R=h.pullRequests.totalCount,z=h.openPRs?.totalCount??0,B=h.closedPRs?.totalCount??0,V=t(R,z,B),H=h.closedIssues?.totalCount??0,U=h.openIssues?.totalCount??0,W=c(H,U),G=h.repositoriesContributedTo?.totalCount??0,K=h.organizations?.totalCount??0;return{user:{login:h.login,name:h.name,avatar_url:h.avatarUrl,bio:null,public_repos:h.repositories.totalCount,followers:A,following:j,created_at:h.createdAt},repos:T.map(e=>({name:e.name,html_url:e.url,stargazers_count:e.stargazerCount,forks_count:e.forkCount,language:e.primaryLanguage?.name??null,fork:e.isFork,archived:e.isArchived})),totalStars:S,topLanguages:C,originalRepos:E,forkedRepos:D,totalForksReceived:O,languageCount:w,accountAge:k,followerRatio:M,totalContributions:v.totalContributions,currentStreak:N.currentStreak,longestStreak:N.longestStreak,mergedPRs:R,openPRs:z,closedPRs:B,prMergeRate:V,closedIssues:H,openIssues:U,issueCloseRate:W,weekendPct:L,reposContributedTo:G,organizations:K,personality:P,velocity:F,avgPerDay:I}}export{d as n,C as r,S as t};