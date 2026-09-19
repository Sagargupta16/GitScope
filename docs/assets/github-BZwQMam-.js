import{a as e,d as t,f as n,h as r,l as i,m as a,o,p as s,u as c}from"./uiLifecycle-DWwVPiev.js";var l={JavaScript:`#f1e05a`,TypeScript:`#3178c6`,Python:`#3572A5`,Java:`#b07219`,Go:`#00ADD8`,Rust:`#dea584`,Ruby:`#701516`,"C++":`#f34b7d`,C:`#555555`,"C#":`#178600`,PHP:`#4F5D95`,Swift:`#F05138`,Kotlin:`#A97BFF`,Dart:`#00B4AB`,Shell:`#89e051`,HTML:`#e34c26`,CSS:`#563d7c`,Vue:`#41b883`,Svelte:`#ff3e00`,Lua:`#000080`,Zig:`#ec915c`,Elixir:`#6e4a7e`,Haskell:`#5e5086`};async function u(e,t){let n=o(void 0,t),r=`/users/${encodeURIComponent(e)}`,i=await n.request(r),a=await n.paginate(`${r}/repos?sort=full_name&direction=asc`,e=>e.html_url);a.sort((e,t)=>t.stargazers_count-e.stargazers_count);let s=a.reduce((e,t)=>e+t.stargazers_count,0),c={},u=0;for(let e of a)e.archived||e.fork||!e.language||(c[e.language]??={count:0,color:l[e.language]||`#8b949e`},c[e.language].count++,u++);return{user:i,repos:a,totalStars:s,topLanguages:Object.entries(c).map(([e,{count:t,color:n}])=>({name:e,count:t,color:n,percentage:u>0?t/u*100:0})).sort((e,t)=>t.count-e.count).slice(0,8),originalRepos:a.filter(e=>!e.fork&&!e.archived).length,forkedRepos:a.filter(e=>e.fork).length,totalForksReceived:a.reduce((e,t)=>e+t.forks_count,0),languageCount:Object.keys(c).length,accountAge:new Date().getFullYear()-new Date(i.created_at).getFullYear(),followerRatio:i.following>0?(i.followers/i.following).toFixed(1):i.followers>0?`∞`:`0`}}var d=`
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
`,f=`
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
`;function p(t){throw new e(`GitHub returned incomplete ${t}. Please refresh.`,`invalid-response`)}async function m(e,t,n){let r=864e5,i=Date.parse(n.toISOString().slice(0,10))-364*r,a=new Map,o={totalCommitContributions:0,totalPullRequestContributions:0,totalPullRequestReviewContributions:0,totalIssueContributions:0};for(let s=0;s<365;s+=92){let c=i+s*r,l=Math.min(i+(s+92)*r-1,n.getTime()),u=new Date(c).toISOString(),d=new Date(l).toISOString(),m=(await t.graphql(f,{username:e,from:u,to:d})).user?.contributionsCollection;m?.contributionCalendar?.weeks||p(`contribution data`);for(let e of Object.keys(o))(!Number.isFinite(m[e])||m[e]<0)&&p(`contribution totals`),o[e]+=m[e];let h=new Map;for(let e of m.contributionCalendar.weeks){Array.isArray(e.contributionDays)||p(`contribution calendar`);for(let t of e.contributionDays){if(t.date<u.slice(0,10)||t.date>d.slice(0,10))continue;(!Number.isInteger(t.contributionCount)||t.contributionCount<0)&&p(`contribution calendar`);let e=h.get(t.date)??a.get(t.date);e&&e.contributionCount!==t.contributionCount&&p(`contribution calendar`),h.set(t.date,t)}}for(let e=c;e<=l;e+=r){let t=new Date(e).toISOString().slice(0,10),n=h.get(t);n||p(`contribution calendar`),a.set(t,n)}}let s=[...a.values()].sort((e,t)=>e.date.localeCompare(t.date));return{...o,contributionCalendar:{totalContributions:s.reduce((e,t)=>e+t.contributionCount,0),weeks:[{contributionDays:s}]}}}async function h(e,t,n){return g(e,o(t,n))}async function g(o,u){let f=new Date,h=await u.graphql(d,{username:o,after:null});if(!h.user)throw new e(`User "${o}" not found`,`not-found`,404);let g=h.user,_=new Map,v=new Set,y=g.repositories;for(;;){(!y?.pageInfo||!Array.isArray(y.nodes))&&p(`repository data`);for(let e of y.nodes)e?.id||p(`repository data`),_.set(e.id,e);if(!y.pageInfo.hasNextPage)break;let e=y.pageInfo.endCursor;(!e||v.has(e))&&p(`repository pagination`),v.add(e);let t=await u.graphql(d,{username:o,after:e});t.user||p(`repository data`),y=t.user.repositories}_.size!==g.repositories.totalCount&&p(`repository pagination`),g.repositories.nodes=[..._.values()];let b=await m(o,u,f),x=b.contributionCalendar,S=g.repositories.nodes.reduce((e,t)=>e+t.stargazerCount,0),C={},w=0;for(let e of g.repositories.nodes){if(e.isArchived||e.isFork||!e.primaryLanguage)continue;let{name:t,color:n}=e.primaryLanguage;C[t]??={count:0,color:n??l[t]??`#8b949e`},C[t].count++,w++}let T=Object.entries(C).map(([e,{count:t,color:n}])=>({name:e,count:t,color:n,percentage:w>0?t/w*100:0})).sort((e,t)=>t.count-e.count).slice(0,8),E=g.repositories.nodes,D=E.filter(e=>!e.isFork&&!e.isArchived).length,O=E.filter(e=>e.isFork).length,k=E.reduce((e,t)=>e+t.forkCount,0),A=Object.keys(C).length,j=new Date().getFullYear()-new Date(g.createdAt).getFullYear(),M=g.followers.totalCount,N=g.following?.totalCount??0,P=N>0?(M/N).toFixed(1):M>0?`∞`:`0`,F=s(x,f),I=n(b.totalCommitContributions,b.totalPullRequestContributions,b.totalPullRequestReviewContributions,b.totalIssueContributions),L=a(x,f),R=i(x),z=r(x),B=g.pullRequests.totalCount,V=g.openPRs?.totalCount??0,H=g.closedPRs?.totalCount??0,U=t(B,V,H),W=g.closedIssues?.totalCount??0,G=g.openIssues?.totalCount??0,K=c(W,G),q=g.repositoriesContributedTo?.totalCount??0,J=g.organizations?.totalCount??0;return{user:{login:g.login,name:g.name,avatar_url:g.avatarUrl,bio:null,public_repos:g.repositories.totalCount,followers:M,following:N,created_at:g.createdAt},repos:E.map(e=>({name:e.name,html_url:e.url,stargazers_count:e.stargazerCount,forks_count:e.forkCount,language:e.primaryLanguage?.name??null,fork:e.isFork,archived:e.isArchived})),totalStars:S,topLanguages:T,originalRepos:D,forkedRepos:O,totalForksReceived:k,languageCount:A,accountAge:j,followerRatio:P,totalContributions:x.totalContributions,currentStreak:F.currentStreak,longestStreak:F.longestStreak,mergedPRs:B,openPRs:V,closedPRs:H,prMergeRate:U,closedIssues:W,openIssues:G,issueCloseRate:K,weekendPct:z,reposContributedTo:q,organizations:J,personality:I,velocity:L,avgPerDay:R}}export{u as n,g as r,h as t};