# food_beverage: what separates effective famous-brand ads (Pitt dataset, n=420)

Alright, listen up. We've got a goldmine here—420 ads, real viewer feedback. This is your playbook for the food and beverage category. No more guessing. Let's break down what works, what bombs, and why. Pay attention.

### 1. What the Most Effective Ads (eff 5) Have in Common

The top-tier ads aren't just good; they're ruthlessly efficient. They do one of a few things exceptionally well.

*   **Razor-Sharp Propositions:** They don't try to be everything to everyone. They pick a lane.
    *   **Product Truth:** They state a simple, concrete fact about the product. **Wendy's** built a legacy on this with "Where's the Beef?", hammering home that they have more meat than competitors. **Burger King** does it too: "The King's Gone Crazy" is about more beef and better value.
    *   **Functional Benefit:** The product solves a clear problem. **Snickers** is the master: "You're not you when you're hungry." It’s not about the chocolate; it's about satisfying hunger and fixing your mood. **Orbit** is another: "it will clean up my mouth." Simple, effective.
    *   **Emotional Transformation:** The product changes your emotional state. **Coca-Cola's** "JINX" ad isn't about refreshment; it's because "it can bring enemies together." **Haribo's** "Pitch" ad works because "it'll make the manliest men feel like children again."

*   **Proven Creative Devices:** They use classic tools, but with precision.
    *   **Humour:** This is the dominant device. Nearly all the top ads have high `funny` scores (0.8-1.0). See **Carlton Draught's** "Beer Chase" or **Snickers'** "betty white" spot. The sentiment is almost always `amused`. It makes the message stick.
    *   **Celebrity as Archetype:** They don't just slap a famous face on it. The celebrity *embodies* the proposition. **Drake** in the Sprite ad isn't just a guy; he *is* "the spark." **Peyton Manning** for Gatorade personifies peak performance. The celebrity is a shortcut to the brand message.
    *   **Mascot/Character:** Mascots give the brand a personality. The **M&M's** characters are "irresistible." The **California Raisins** are a "party in your mouth." They make an inanimate product relatable and memorable.
    *   **Clear Demo:** When the benefit is about taste or preparation, they show it. The **Knorr** ads ("Cómo hacer pollo guisado") are just simple, appetising cooking demos. Viewers repeat back, "it will enhance the flavor of the dish." Show, don't tell.
    *   **Simple Story:** The story serves the proposition. **Life Cereal's** "Mikey likes it!" is a tiny, perfect story proving one thing: "picky eaters like it." **Folger's** "Peter Comes Home For Christmas" sells the feeling of home, not just coffee.

*   **A Confident, Positive Tone:** The ads are overwhelmingly `amused`, `eager`, `cheerful`, or `active`. There's an energy and optimism that's infectious. They make you *want* to feel the way the ad feels.

### 2. What the Weakest Ads (eff ≤ 3) Do Wrong

The ads that fail are a masterclass in muddled thinking.

*   **Vague or Non-Existent Proposition:** This is the cardinal sin. Viewers watch an ad and have no idea why they should act. For **Jammie Dodgers'** "A Certain Gooey Thing" (eff 1), a viewer wrote the reason to act was "Because its the right thang to do i guess to promote song." That’s a total failure. The ad was about the ad, not the product.
*   **Borrowed Interest That Goes Nowhere:** They use a celebrity or a cool visual, but it doesn't connect to a benefit. The **evian** "BABY&ME" ad (eff 1) is visually memorable, but the viewer takeaway is a weak, generic "it will help me stay young." The link is tenuous. Compare that to the Snickers/Betty White spot, where the celebrity is integral to the "You're not you when you're hungry" idea.
*   **Generic Benefits:** They fall back on clichés. "It's refreshing" is the most common and least effective. A low-rated **Sprite** ad (eff 1) gets this feedback. So is water. So is a breeze. It’s not ownable. "It tastes good" is another. The eff 5 ads are specific: *how* it tastes good ("hot and sweet," "more beef," "spicy and has a kick").
*   **Confusing Execution:** The story is too abstract, the humour doesn't land, or the visual metaphor is unclear. Low-rated ads often leave viewers with a shrug. **Mountain Dew's** "Man into woman" ad (eff 3) has a viewer say, "Because drinking soda changes what is going on, at the current moment." It’s a confused interpretation of a confusing ad.

### 3. The Propositions Viewers Actually Repeat Back

This is the most important list you'll get. These are the 10 clearest "because..." statements that land with viewers. Your script needs to deliver one of these, explicitly or implicitly.

1.  **...it satisfies my hunger / fixes my bad mood.** (Snickers — "betty white snickers commercial")
2.  **...it gives me energy / helps me perform better.** (Gatorade — "Peyton Manning - Gatorade Commercial")
3.  **...it brings people together / fosters connection.** (Coca-Cola — "Coca Cola Super Bowl Television Commercial "JINX"")
4.  **...it has more/better ingredients than the others.** (Wendy's — "Wendy's 1984 Where's The Beef Commercial")
5.  **...it helps me stay healthy / provides nutrients.** (Anlene — "Anlene Advertisement")
6.  **...it freshens my breath / makes my mouth feel clean.** (Orbit — "Orbit Commercial Janice Dickinson")
7.  **...I can have it my way / customize it.** (Burger King — "Vintage Burger King Commercial - Have it Your Way - 1974")
8.  **...it helps me make quick, delicious meals for my family.** (Knorr — "Cómo hacer pollo guisado | Knorr® Sabor")
9.  **...it's a good deal / saves me money.** (Quizno's — "Quizno's | "Toasty Torpedo"")
10. **...it makes me feel like a kid again / reminds me of good times.** (Haribo — "HARIBO Tangfastics Advert 2016 - Pitch")

### 4. Do Exciting / Funny / Particular Sentiments Help Here?

Yes, unequivocally. But it's not random.

*   **Funny is Money:** Across the eff 5 ads, the average `funny` score is a staggering **0.79**. For the weakest (eff ≤ 3) ads, it's **0.67**. A 12-point difference is significant. Humour, when done well, is a direct path to effectiveness. The top ads often score a perfect 1.0, with the dominant sentiment being `amused`.
*   **Excitement Creates Desire:** The average `exciting` score for eff 5 ads is **0.60**, compared to **0.55** for the weak ones. High-energy, visually dynamic ads (like **Cornetto's** "Dubstep" or **Pepsi's** "Michael Jackson") create an `eager` or `active` feeling that transfers to the product.
*   **Target a Specific Emotion:** It's not just about being positive. It's about being *something*. The most effective ads cluster around `amused`, `eager`, and `cheerful`. But deeply `emotional` ads like **Folger's** "Peter Comes Home For Christmas" (eff 5, emotional) or message-driven ads like **McDonald's** "France gay ad Come As You Are" (eff 5, calm) also work because they commit fully to a single, powerful feeling. Weak ads have a muddled emotional profile.

### 5. Brand-Specific Patterns Worth Copying

Notice how the big players carve out distinct territories.

*   **McDonald's vs. Burger King:** This is a perfect study in contrasts.
    *   **Burger King** is the challenger. Their ads are about product superiority ("more beef"), value ("The King's Gone Crazy"), or customization ("Have it Your Way"). The tone is often irreverent and funny. They attack.
    *   **McDonald's** is the incumbent. They sell the brand experience and emotion. Ads focus on inclusion ("Come As You Are"), bonding ("#1 McDonalds BF&GF"), and timeless moments ("I'm lovin' it"). They sell the feeling of being at McDonald's, not just the burger.

*   **Snickers:** A masterclass in a single-minded proposition. Every single effective ad—"betty white," "Mr. T," "Joe Pesci," "Mr Bean"—is a new execution of the exact same idea: "You're not you when you're hungry." They never deviate. It’s relentless and brilliant.

*   **Knorr:** The epitome of utility. Their effective ads are almost all titled "Cómo hacer..." ("How to make..."). They are simple, direct recipe demonstrations. The proposition is pure utility: we help you make delicious food, easily. No celebrities, no complex stories. Just the product in action.

### 6. 10 Concrete Rules for Writing an Ad in This Genre

Pin this to your wall.

1.  **Have One, and Only One, Proposition.** Don't try to say it tastes great, is healthy, AND brings people together. Pick one.
    *   *Example:* **Snickers** — "You're not you when you're hungry." That's it.

2.  **Make the Benefit Concrete.** Don't say "refreshing." Say *how* it's refreshing.
    *   *Example:* **YORK PEPPERMINT PATTIE** — "it will give you a satisfying cooling sensation." The physical sensation is the benefit.

3.  **If You Claim Superiority, Prove It Visually.** Don't just say you're better. Show it.
    *   *Example:* **Wendy's** — "Where's the Beef?" They literally show the competitor's tiny patty versus their own.

4.  **A Tagline Should Be the Strategy in Disguise.** The best taglines are memorable because they are the core reason to believe.
    *   *Example:* **Burger King** — "Have it Your Way." It's not just a line; it's a promise of customization that defined their brand for decades.

5.  **Use Humour to Disarm and Persuade.** If you're going to be funny, commit. A half-joke is worse than no joke.
    *   *Example:* **Carlton Draught** — "Beer Chase." A full-blown, movie-level parody that is so over-the-top it's unforgettable.

6.  **Sell a Feeling, Not Just a Feature.** People buy what the product helps them feel.
    *   *Example:* **Coca-Cola** — "Open Happiness." They aren't selling sugar water; they're selling joy, summer, and togetherness.

7.  **When in Doubt, Demonstrate.** Show the product making life better, easier, or more delicious.
    *   *Example:* **Knorr** — "Cómo hacer bistec de res." The ad is the recipe. The proposition is the delicious result you see on screen.

8.  **Find a Real Human Truth.** Base your idea on a genuine insight about people.
    *   *Example:* **Life Cereal** — "Mikey likes it!" The truth is that getting picky kids to eat anything is a nightmare. This ad offers a solution.

9.  **Your VO/Copy Should Echo the Viewer's "Why".** Write the copy that you want the viewer to repeat back to you.
    *   *Example:* **Orbit Gum's** viewers say, "it will clean up my mouth." The ads talk about cleaning up a "dirty mouth." It’s a direct transfer of messaging.

10. **Own a Moment.** Connect your product inextricably to a specific time or occasion.
    *   *Example:* **NESCAFÉ** — "NESCAFÉ Morning Band TV Ad." The proposition: Nescafé "switches on your mornings." They own the start of the day.

This data is your map. Don't get lost. Be clear, be confident, and give them a single, powerful reason to act. Now, go write something that works.

*(Note: Insights are based on the provided dataset of 420 ads. A larger, more diverse sample could yield different or more nuanced patterns.)*