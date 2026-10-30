# Speech vendor terms and prices, as read (AMENDMENTS-AUDIO-CLIPS AC-B1, 8.2; row AC-3)

What each speech vendor's terms and price pages said on the day they were read, for the generated Korean clips of `AMENDMENTS-AUDIO-CLIPS.md` (Part B). Every licence row of a generated clip (`content/assets-license.csv`, category `audio-tts`) names the terms url and the date it was read, in the format `tts:<vendor>/<engine>/<voice>; rate <r>; generated <YYYY-MM-DD>; terms <url> read <YYYY-MM-DD>`, so a clip is tied to the terms of that date (risk table, spec section 10). The spec's section 13 points here; AC-5 adds the pilot result there.

Read on **2026-10-29** (US Pacific; 2026-10-30 UTC) from the public pages with no vendor account and no credential. This is a record of what the pages say, read by an agent, not legal advice. Re-read a page and add a dated entry below before generating a pack under terms that may have changed.

Flags in one place:

| Vendor | Age clause that reaches our voices | Generative-AI clause that reaches our voices | Output right for stored, shipped clips | Note |
|---|---|---|---|---|
| Amazon Polly (Neural) | **None.** The only under-13 clause in section 50 is for Amazon Lex (50.4). | **None for Neural.** Polly is not in the list of services with generative AI features (1.24) nor in the Indemnified Generative AI Services (50.10). Polly's own Generative and Long-form engines are refused by the generator anyway (AC-B1). | 50.2: "The output that you generate using AI Services is Your Content." The pricing page: "you can cache and replay Amazon Polly’s generated speech at no additional cost." | 50.3: AWS may use and store the text sent to Polly to improve the service unless an AI services opt-out policy is set in AWS Organizations. What is sent is public course text with no personal data; the opt-out is optional (owner runbook section M). |
| Google Cloud TTS (Neural2, WaveNet) | **None for Neural2 or WaveNet.** Section 20(d) (under 18) applies to Generative AI Services only. | Text-to-Speech is listed under "AI/ML Services, Pre-Trained APIs", not under "Generative AI Services". The list's last line ("any generative AI features or functionality of a Service") reaches Chirp 3 HD, which Google describes as powered by generative models: **excluded** (AC-B1), and refused by the generator. | The terms neither grant nor restrict ownership of classic TTS output beyond section 17 (residual risk, AC-B1). | Section 17(b)(i) ("substitute, replace, or circumvent the use of a Google Model") does not say whether generating once and replaying counts; recorded as residual risk; Polly wins a tie (AC-B2). |
| Azure Speech (S0, standard neural) | None found in the AI Code of Conduct beyond the general rule not to exploit vulnerabilities due to age. | HD (Dragon HD) voices are excluded (AC-B1) and refused by the generator. | Paid tier only (Product Terms, see below; **not read first-hand**: the page did not load for the agent). | Fallback only. Read the Product Terms in a browser before any Azure run. The Code of Conduct requires disclosing synthetic voices: the credits line of AC-B10 covers it. |

## Amazon Polly

### AWS Service Terms

- URL: https://aws.amazon.com/service-terms/ (the page says "Last Updated: October 29, 2026"). Read 2026-10-29.
- **There is no section of its own for Amazon Polly.** Polly is named in section 50, "AWS Machine Learning and Artificial Intelligence Services", which is the section that applies to it. The subsections that apply to Polly are quoted verbatim below; 50.6 (hazardous environments, healthcare), 50.7 (Mobile SDK binaries), 50.8 and 50.9 (Rekognition), 50.10 (indemnity for the listed generative services, which do not include Polly) and 50.12 onward (Bedrock, Amazon Q, Kiro, AgentCore Payments, Claude Platform on AWS, Amazon Quick) name other services.
- Age or generative-AI clause for Polly: **none** (see the flags above).

> 50. AWS Machine Learning and Artificial Intelligence Services
>
> 50.1. “AI Services” means, collectively, Amazon Bedrock, Amazon CodeGuru Profiler, Amazon CodeGuru Reviewer, Amazon Foundation Models (Amazon Nova and Titan models), Amazon Nova Act, Amazon Nova Forge, Amazon Comprehend, Amazon Comprehend Medical, Amazon DevOps Guru, Amazon Forecast, AWS HealthLake, Amazon Kendra, Amazon Lex, Amazon Lookout for Metrics, Amazon Personalize, Amazon Polly, Amazon Q, AWS Transform, Amazon Rekognition, Amazon Textract, Amazon Transcribe, Amazon Transcribe Medical, Amazon Translate, AWS HealthOmics, AWS HealthImaging, AWS HealthScribe, AWS App Studio, Kiro, Amazon Quick, AWS Elemental Inference, AWS DevOps Agent, AWS Continuum (including features previously named AWS Security Agent), AWS FinOps Agent (Preview), the model customization agent in SageMaker AI, and AWS IoT SiteWise Scenario Discovery. “AI Content” means Your Content that is processed by an AI Service.
>
> 50.2. The output that you generate using AI Services is Your Content. Due to the nature of machine learning, output may not be unique across customers and the Services may generate the same or similar results across customers.
>
> 50.3. You agree and instruct that for Amazon CodeGuru Profiler, Amazon Comprehend, AWS Continuum (excluding Continuum for penetration testing, previously named AWS Security Agent), Amazon Lex, Amazon Polly, Amazon Rekognition, Amazon Textract, Amazon Transcribe, Amazon Translate, AWS Transform, AWS FinOps Agent (Preview), Kiro Free Tier, and Kiro individual subscribers (as described here): (a) we may use and store AI Content that is processed by each of the foregoing AI Services to develop and improve the applicable AI Service and its underlying technologies; (b) we may use and store AI Content that is not personal data to develop and improve AWS and affiliate machine-learning and artificial-intelligence technologies; and (c) solely in connection with the development and improvement described in clauses (a) and (b), we may store such AI Content in an AWS region outside of the AWS region where you are using such AI Service. This Section does not apply to Amazon Comprehend Medical, Amazon Transcribe Medical, AWS HealthScribe, Amazon Comprehend Detect PII or any AI Service that is not listed in the first sentence of this Section 50.3. You may instruct AWS not to use and store AI Content processed by an AI Service to develop and improve that Service or technologies of AWS or its affiliates by configuring an AI services opt-out policy using AWS Organizations. For access to AI Services via AWS Builder ID or a third-party authentication provider, you may instruct AWS to refrain from using and storing AI Content processed by an AI Service to develop and improve that Service or technologies of AWS or its affiliates by using the opt-out mechanism indicated in the applicable service documentation.
>
> 50.4. You are responsible for providing legally adequate privacy notices to End Users of your products or services that use any AI Service and obtaining any necessary consent from such End Users for the processing of AI Content and the storage, use, and transfer of AI Content as described under this Section 50. You represent to us that you have provided all necessary privacy notices and obtained all necessary consents. You are responsible for notifying us in the event that any AI Content stored by an AI Service must be deleted under applicable law. If you use Amazon Lex in connection with websites, programs or other applications that are directed or targeted, in whole or in part, to children under age 13 and subject to COPPA or similar laws you must: (a) provide all required notices and obtain all required verifiable parental consent under COPPA or similar laws; and (b) notify AWS during the Amazon Lex set-up process using the appropriate (i) check box in the AWS console or (ii) Boolean parameter in the applicable Amazon Lex Model Building Service API request or response as specified by the Amazon Lex technical documentation. Amazon Lex does not store or retain voice or text utterance information from websites, programs, or other applications that you identify in accordance with this Section as being directed or targeted, in whole or in part, to children under age 13 and subject to COPPA or similar laws.
>
> 50.5. Except where permitted by the AI Service, you may not use an AI Service to generate Content for the express purpose of training an AI model or service or developing a substantially similar AI model or service.
>
> 50.11. Neither you nor your End Users will, or will attempt to, extract or derive underlying components, including any model, model parameters, or model weights or reproduce the training data of AI Services.

The general AI terms of section 1 that apply to every AI service, verbatim (1.24 lists the services with generative AI features; Polly is not among them):

> 1.23. If you use any artificial intelligence and machine learning Services, features, and functionality (including third-party models) that we provide, it’s your responsibility to ensure that your use complies with all applicable laws, rules, and regulations, and the AWS Responsible AI Policy.
>
> 1.24. Certain Services may incorporate generative AI features, powered by Amazon Bedrock, that enable you to use prompts to generate output, including: Amazon Bio Discovery, Amazon CloudWatch, Amazon CodeCatalyst, Amazon Connect Customer, Amazon Connect Decisions, Amazon Connect Health, Amazon Connect Talent, AWS Database Migration Service, Amazon DataZone, Amazon Lex, Amazon OpenSearch Service, Amazon Personalize, Amazon Q, AWS Entity Resolution, AWS Transform, AWS AppFabric, AWS HealthScribe, AWS Resilience Hub, AWS App Studio, Kiro, Amazon SageMaker Data Agent, the model customization agent in SageMaker AI, Amazon Quick, AWS DevOps Agent, AWS Continuum (including features previously named AWS Security Agent), AWS FinOps Agent (Preview), Amazon WorkSpaces, AWS Deadline Cloud, and Amazon GuardDuty.

### Amazon Polly pricing

- URL: https://aws.amazon.com/polly/pricing/. Read 2026-10-29.
- Neural voices: **$16.00 per 1 million characters** outside the free tier; free tier **1 million characters per month for the first 12 months**. Standard $4.00, Long-Form $100.00, Generative $30 per 1 million (not used).
- Verbatim: "You are charged based on the number of characters of text that you convert either to speech or to Speech Marks metadata. In addition, you can cache and replay Amazon Polly’s generated speech at no additional cost."
- Verbatim: "For Neural voices, the free tier includes 1 million characters per month for speech or Speech Marks requests, for the first 12 months."
- New accounts since July 15, 2025 get up to $200 of AWS Free Tier credits (the page; free plan for 6 months, credits used within 12 months).

## Google Cloud Text-to-Speech

### Service Specific Terms

- URL: https://cloud.google.com/terms/service-terms (the page says "Last modified October 27, 2026"). Read 2026-10-29. Services list: https://cloud.google.com/terms/services ("Last modified October 21, 2026"), where Text-to-Speech is under "AI/ML Services", "Pre-Trained APIs": "Text-to-Speech synthesizes human-like speech based on input text in a variety of voices and languages."
- Section 17 (formerly 16), verbatim:

> 17. Use Restrictions for AI/ML Services (formerly Section 16 (Use Restrictions for AI/ML Services)).
>
> a. Competitive Use. Customer will not, and will not allow End Users to use an AI/ML Service or Generated Output to develop a similar or competing product or service. Google may immediately suspend or terminate Customer's use of any AI/ML Service based on any suspected violation of the preceding sentence. This restriction does not apply to Gemini Enterprise Agent Platform (formerly Vertex AI Platform) so long as Customer does not use a Google Pre-Trained Model.
>
> b. Model Restrictions. Customer will not, and will not allow End Users to, use output from an AI/ML Service (including Generated Output) to: (i) substitute, replace, or circumvent the use of a Google Model, directly or indirectly, or (ii) create or improve models similar to a Google Model. However, if an AI/ML Service offers the feature of fine-tuning or model distillation, Customer may use output from that AI/ML Service (including Generated Output) to modify and use Modified Google Models instead of Google Pre-Trained Models.
>
> c. No Reverse Engineering. Customer will not, and will not allow End Users to, reverse engineer or extract any components of an AI/ML Service, Software, or its models (such as using prompts to discover training data). Google may immediately suspend or terminate Customer's use of any AI/ML Service based on any suspected violation of the preceding sentence.

- Section 20 (formerly 19), the parts AC-B1 relies on, verbatim:

> 20. Generative AI Services (formerly Section 19 (Generative AI Services)).
>
> a. Definition. “Generated Output” means the data or content generated by a Generative AI Service prompted by Customer Data. Generated Output is Customer Data. As between Customer and Google, Google does not assert any ownership rights in any new intellectual property created in the Generated Output. For the purposes of subsections (b) through (h) below, “Generative AI Services” includes Agentic AI Services.
>
> d. Age Restrictions. Customer will not, and will not allow End Users to, use a Generative AI Service as part of a website, Customer Application, or other online service that is directed towards or is likely to be accessed by individuals under the age of 18.

- Reading: Neural2 and WaveNet are classic (non-generative) TTS, so 20(a) is not their output basis and 20(d) does not reach them; 17 does. Chirp 3 HD and Gemini-TTS fall under 20 through the services list's last line and are excluded.

### Text-to-Speech pricing

- URL: https://cloud.google.com/text-to-speech/pricing. Read 2026-10-29.
- "Legacy TTS models": **Neural2 0 to 1 million characters free per month, then US$16 per 1 million**; **WaveNet 0 to 4 million free, then US$4 per 1 million**; Standard 0 to 4 million free, then US$4; Studio 0 to 1 million free, then US$160. Chirp 3: HD voices 0 to 1 million free, then US$30 per 1 million (excluded).
- Verbatim: "Text-to-Speech is priced based on the number of characters sent to the service to be synthesized into audio each month. You must enable billing to use Text-to-Speech, and will be automatically charged if your usage exceeds the number of free characters allowed per month."
- The generator counts every character it sends, SSML tags included, so its count is never below what Google bills.

## Microsoft Azure Speech (fallback)

- Product Terms: https://www.microsoft.com/licensing/terms/productoffering/MicrosoftAzure/MCA. **Not read first-hand on 2026-10-29**: the page is an application the agent's fetch could not load. The sentence AC-B1 relies on is quoted, citing that page, in a Microsoft Q&A thread of 2026-03-03 (https://learn.microsoft.com/en-us/answers/questions/5805156/please-clarify-the-conflicting-information-regardi): "TTS Service output use rights: For Customers of the paid tier TTS Service only, Customer may use the audio output of prebuilt neural voices generated using the TTS Service, including for commercial purposes." Before any Azure run, open the Product Terms in a browser, find the Azure Speech section, confirm or correct this sentence, and add a dated entry here. Until then the Azure engine is not used (Polly and Google are the pilot), and the generator enforces it: `AZURE_TERMS_READ` in `apps/mobile/scripts/audio/tts/engines/azure.mjs` is `null`, so a real `--engine azure` run is refused (a dry run still works). The change that adds the dated first-hand entry here sets that constant to the date read.
- AI Code of Conduct (https://learn.microsoft.com/en-us/legal/ai-code-of-conduct, version 4.0 of 2026-05-01, which replaces the separate text-to-speech code), Responsible AI requirement 3, verbatim: "Disclose when the output, decisions, or actions are generated by AI, including the synthetic nature of generated voices, images, and/or videos, such that users are not likely to be deceived or duped – or able to deceive or dupe others – into believing they are interacting with a real person, that any generated content is authentic or, without their consent, attributable to a specific individual, or that any AI-generated decision or action is done by a human." The credits line of AC-B10 (AU-OD-9) covers it.
- Pricing: https://azure.microsoft.com/pricing/details/cognitive-services/speech-services/ (not read for a figure on 2026-10-29; the free F0 tier has no commercial output right in the reading above, so only S0 is used). The $16 per 1M characters the generator's dry run uses for Azure (`pricePerMillion` in `engines/azure.mjs`) is an **unsourced estimate**, the same rate as Polly Neural and Google Neural2; record the figure from the pricing page, with the date read, together with the Product Terms entry above. AC-B1 notes that Azure bills hanja double, not Hangul.

## Cost against the budget (spec 8.2, AU-OD-8)

- Measured with the generator's own count (`--dry-run`, 2026-10-30, manifest of 1,280 clips): the pilot on Polly (Seoyeon and Jihye, 81 rows each) is 162 requests and 7,746 billed characters; on Google (Neural2-A and -C) 456, because only an IPA override carries SSML there. A full pass of every pack in one Polly voice is 1,280 requests and 64,815 characters, about $1.04 before the free allowance (spec 8.1 estimated about 62,000). Both stay inside the free allowances above, and far under the **$50 budget**.
- The budget is a billing alert on each account, set before the first run, plus the generator's `--max-chars` cap, which stops before the request that would cross it. A billing alert alone does not stop spend. The cap's default is the run's own count plus 10 %, so on its own it only restates the plan; two limits do not depend on the plan: a **$50 ceiling** (what $50 buys at the dearest voice of the run, before any free allowance; 3,125,000 characters at $16 per 1M), which caps the default and any `--max-chars`, and an explicit `--max-chars` set to the number the dry run printed (runbook M-2).
