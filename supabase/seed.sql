-- Optional demo data so the dashboard has something to show.
insert into leads (first_name, last_name, email, phone, source, status, message, service, intent, priority, ai_summary, ai_reply, ai_processed_at, created_at)
values
('Emily', 'Carter', 'emily.carter@example.com', '207-555-0142', 'website', 'new',
 'Hi, I just moved to Portland and need a new dentist. Do you take Delta Dental? Would love a cleaning soon.',
 'Cleaning', 'new_patient', 'normal',
 'New patient, has Delta Dental, wants a cleaning.',
 'Hi Emily,\n\nWelcome to Portland! Yes, we accept Delta Dental. We''d love to get you in for a new patient exam and cleaning — we have openings this week. Would a morning or afternoon work better for you?\n\nWarmly,\nSwish Dental',
 now(), now() - interval '2 hours'),
('Marcus', 'Lee', 'marcus.lee@example.com', '207-555-0199', 'email', 'new',
 'My back tooth cracked last night and it hurts a lot when I bite. Can anyone see me today?',
 'Emergency', 'emergency', 'urgent',
 'Cracked molar with pain — needs same-day emergency visit.',
 'Hi Marcus,\n\nI''m so sorry to hear that — a cracked tooth with pain is something we want to see right away. We can fit you in today. Please call us at the number below or reply with the earliest time you can come in, and we''ll hold a spot for you.\n\nIn the meantime, avoid chewing on that side and take over-the-counter pain relief as directed.\n\nSwish Dental',
 now(), now() - interval '40 minutes'),
('Sofia', 'Nguyen', 'sofia.n@example.com', null, 'website', 'contacted',
 'How much is Invisalign roughly? And do you offer payment plans?',
 'Invisalign', 'price_inquiry', 'normal',
 'Asking Invisalign cost and financing.',
 'Hi Sofia,\n\nThanks for reaching out! Invisalign pricing depends on the length of treatment, and we offer flexible payment plans. The best next step is a free consultation with a digital smile scan so we can give you an exact quote. Would you like me to book one for you?\n\nSwish Dental',
 now(), now() - interval '1 day'),
('Jake', 'Morrison', 'jake.m@example.com', '207-555-0111', 'website', 'booked',
 'Looking to book a checkup for my 6 year old.',
 'Kids Dentistry', 'kids', 'normal', 'Parent booking checkup for 6-year-old.', null, now(), now() - interval '3 days');

insert into appointments (patient_name, patient_email, service, starts_at, ends_at, status, title)
values
('Jake Morrison (child)', 'jake.m@example.com', 'Kids Checkup', date_trunc('day', now()) + interval '10 hours', date_trunc('day', now()) + interval '10 hours 45 minutes', 'scheduled', 'Kids Checkup — Morrison'),
('Anna Roberts', 'anna@example.com', 'Cleaning', date_trunc('day', now()) + interval '13 hours', date_trunc('day', now()) + interval '14 hours', 'scheduled', 'Cleaning — Roberts'),
('Tom Baker', 'tom@example.com', 'Crown', date_trunc('day', now()) + interval '1 day 9 hours', date_trunc('day', now()) + interval '1 day 10 hours 30 minutes', 'scheduled', 'Crown — Baker'),
('Lena Ortiz', 'lena@example.com', 'Cleaning', date_trunc('day', now()) - interval '1 day 15 hours', date_trunc('day', now()) - interval '1 day 14 hours', 'completed', 'Cleaning — Ortiz');
