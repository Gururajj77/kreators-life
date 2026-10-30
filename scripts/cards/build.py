"""Step 2 of 3. Turns decks.json (from extract.py) into one cards JSON; seed.py then makes the D1 migration from it.

    python3 scripts/cards/build.py decks.json cards.json
"""
import json,re,sys
d=json.load(open(sys.argv[1]))
J=lambda xs:re.sub(r'\s+',' ',' '.join(xs)).strip()
def clean(t):
    t=re.sub(r'[\x00-\x1f]','',t); t=t.replace('⬆️','').replace('️','')
    t=re.sub(r'(?<=[a-z])- (?=[a-z])','-',t)
    return re.sub(r'\s+',' ',t).strip()
def fixcase(w):
    return w[0]+w[1:].lower() if re.search(r'[a-z][A-Z]',w) else w
def title(t):
    t=clean(t); t=re.sub(r'\bLOVE$','',t).strip()
    return ' '.join(fixcase(w) for w in t.split())
def pages(k): return d[k][1:]  # page 0 is the cover
out={}
def game(key,name,tagline,decks,**kw):
    out[key]={"key":key,"name":name,"tagline":tagline,"decks":decks,**kw}
def dedupe(cards):
    seen=set(); res=[]
    for c in cards:
        k=json.dumps([c.get("title"),c.get("text"),c.get("alt"),c.get("list")],sort_keys=True)
        if k in seen: continue
        seen.add(k); res.append(c)
    return res

# Ulta Seedha
cards=[]
for p in pages("01 Ulta Seedha/Ulta Seedha.pdf"):
    i=[n for n,b in enumerate(p) if re.match(r'seedha',b,re.I)][0]
    j=[n for n,b in enumerate(p) if re.match(r'ulta',b,re.I)][0]
    cards.append({"label":"Seedha: Truth","text":clean(J(p[i+1:j])),"alt":{"label":"Ulta: Dare","text":clean(J(p[j+1:]))}})
game("ulta_seedha","Ulta Seedha","A game to help you overcome approach anxiety.",[{"key":"main","name":"Truth or dare","cards":dedupe(cards)}],
     howTo="Draw a card. Pick the Seedha side (a truth) or flip it for the Ulta side (a dare).")

# Date Connect
dc=[]
for k,nm,key in [("02 Date Connect/01 OPEN ICE Breakers.pdf","Ice Breakers","ice"),("02 Date Connect/02 Bond Builders.pdf","Bond Builders","bond"),("02 Date Connect/03 Connect Us Deeply.pdf","Connect Us Deeply","deep")]:
    cards=[]
    for p in pages(k):
        a=[n for n,b in enumerate(p) if b.startswith('THIS')][0]
        t=[n for n,b in enumerate(p) if b=='THAT'][0]
        cards.append({"label":"This","text":clean(J(p[:a])),"alt":{"label":"That","text":clean(J(p[t+1:]))}})
    dc.append({"key":key,"name":nm,"cards":dedupe(cards)})
game("dateflow_connect","DateFlow Connect","A game for better dating experiences.",dc,
     howTo="Shuffle the deck and deal 5 cards to each player. On your turn, draw a card and do the This prompt or flip it for the That activity. Each task you complete earns points. Reach certain points to win cool rewards. The game has three levels of cards: Ice Breakers, Bond Builders and Connect Us Deeply.",
     special=["Switch Turns: The next player skips their turn.","Double Points: Earn double points for the next card completed.","Wild Card: Choose any card from the deck and complete it.","Reverse: Change the direction of play.","Draw Two: The next player draws two cards and completes both prompts."])

# Date Guru
cards=[]
for p in pages("03 Date Guru/Date Guru.pdf"):
    cards.append({"title":clean(p[1]),"text":clean(p[2]).strip('“”"'),"alt":{"label":"The idea","text":clean(J(p[3:]))}})
game("date_guru","DateGuru","A game for better dating experiences.",[{"key":"main","name":"52 lessons","cards":dedupe(cards)}],
     howTo="Draw a card and read the lesson. Flip it for the idea behind it, then try it on your next date.")

# HealFlow
hf=[]
for k,nm,key in [("04 HealFlow/01 Emotions.pdf","Emotions","emotions"),("04 HealFlow/02 Stories.pdf","Stories","stories"),("04 HealFlow/03 Activities.pdf","Activities","activities"),("04 HealFlow/04 Improv.pdf","Improv","improv"),("04 HealFlow/05 Inner Child.pdf","Inner Child","inner")]:
    cards=[]
    for p in pages(k):
        t=title(p[0]); t=re.sub(r'^(.+?) \1$',r'\1',t)
        body=[b for b in p[1:] if not b.startswith('Start a story about a happy family memory') or key=='stories']
        cards.append({"title":t,"text":clean(J(body))})
    hf.append({"key":key,"name":nm,"cards":dedupe(cards)})
game("healflow","HealFlow","For mindful families who want to heal, bond and connect over fun, therapeutic activities.",hf,
     howTo="Take turns drawing a card and doing what it says together.",
     special=["Double Points: Double the points for the next 2 prompts.","Swap: Swap a card with another player.","Wildcard: Player chooses any card from the deck."],
     specialNote="Pick any one.")

# FunFlow
ff=[]
rules=None
for k,nm,key in [("05 FunFlow/01 Endorphins.pdf","Endorphins","endorphins"),("05 FunFlow/02 Oxcytocin.pdf","Oxytocin","oxytocin"),("05 FunFlow/03 Serotonin.pdf","Serotonin","serotonin"),("05 FunFlow/04 Dopamine.pdf","Dopamine","dopamine")]:
    cards=[]
    for p in pages(k):
        t=clean(p[1]); body=p[2:]
        text=[];lst=[]
        for n,b in enumerate(body):
            if re.match(r'.*Examples,?$',b): 
                rest=J(body[n+1:]); lst=[x for x in (clean(y) for y in rest.split('+')) if len(x)>=8 and ' ' in x]; break
            if '(Answer:' in b or b.startswith('"Is it') or b.startswith('I, "') : 
                rest=J(body[n:])
                if '(Answer:' in rest:
                    lst=[f"{q.strip()} Answer: {a.strip()}" for q,a in re.findall(r'[“"]([^”"]+?)[”"]\s*\(Answer:\s*([^)]*)\)',rest)]
                else:
                    lst=[q.strip()+'?' for q in re.findall(r'"([^"?]+)\?',rest)]
                break
            text.append(b)
        c={"title":t,"text":clean(J(text))}
        if lst: c["list"]=list(dict.fromkeys(lst))
        cards.append(c)
    # merge duplicate titles keeping the one with the list
    byt={}
    for c in cards:
        if c["title"] in byt:
            if c.get("list") and not byt[c["title"]].get("list"): byt[c["title"]]=c
        else: byt[c["title"]]=c
    ff.append({"key":key,"name":nm,"cards":list(byt.values())})
game("funflow","FunFlow","For friends and teams who want to bond and grow together.",ff,
     howTo="Pick a deck, draw a card and play what it says. Most games work with 2 or more people; 2 to 6 is best.",
     rules=["Number of players: Most games can be played by 2 or more people. For best results, 2 to 6 players are recommended.","Turn-based play: Players take turns. On each turn, the player follows the game on the card, such as asking a question, making a guess or doing a task.","Time limit (optional): In some games, like 20 Questions and Guess the Sound, set a time limit for answers, for example 30 seconds, to keep the game moving.","No repeats: A card or idea used once in a round cannot be used again by any player for the rest of the round.","Points and winning (optional): Give points for right guesses, good actions or a round with no mistakes. The first player to a set number of points, for example 10, wins.","Respect and fun: Always be respectful and keep the mood light. The goal is to have fun, build connections and be creative.","Tie-breakers: If there is a tie, use a quick round like Rock, Paper, Scissors to find the winner.","Adaptability: Feel free to change the rules or make your own house rules to suit the mood and the group.","20 Questions: The player thinking of the person, place or thing may only answer yes or no. The guessing player gets exactly 20 questions.","Two Truths and a Lie: Each player gives three statements, two true and one false, in one turn. The other player gets one guess at the lie.","Story Chain: Players build on the previous sentence, and each sentence must be grammatically correct. Nothing said before can be erased."])

# 7RP
rp=[]
covers={}
for k,key in [("06 7RP/01 Servitude.pdf","servitude"),("06 7RP/02 Friendships.pdf","friendships"),("06 7RP/03 Care Takers Child.pdf","caretakers"),("06 7RP/04 Lover Partner.pdf","lover"),("06 7RP/05 Self.pdf","self"),("06 7RP/06 Guru Disciple.pdf","guru"),("06 7RP/07 Divine.pdf","divine")]:
    cov=d[k][0]; cards=[{"title":clean(p[0]),"text":clean(J(p[1:]))} for p in pages(k)]
    rp.append({"key":key,"cover":cov,"cards":dedupe(cards)})
game("relationship_method","The Relationship Method Challenge","One small daily challenge for each of the seven relationships.",[{"key":x["key"],"name":x["cover"][0],"cards":x["cards"]} for x in rp],howTo="Pick a relationship and draw a card. Do the challenge today, then draw again tomorrow.")
# Roast/Flirt
def rf(k):
    cards=[]
    for p in d[k]:
        if not p: continue
        a=[n for n,b in enumerate(p) if b.startswith('Roast')][0]
        f=[n for n,b in enumerate(p) if b=='Flirt'][0]
        cards.append({"label":"Roast","text":clean(J(p[:a])),"alt":{"label":"Flirt","text":clean(J(p[f+1:]))}})
    return dedupe(cards)
game("roast_or_flirt","Roast or Flirt","Build better self-esteem with your relationships power.",[{"key":"english","name":"English","cards":rf("07 RF Eng/Roast Flirt English.pdf")},{"key":"hinglish","name":"Hinglish","cards":rf("08 RF Hindi/Roast Flirt Hindi.pdf")}],
     howTo="Draw a card. Read the roast out loud, or flip it and pick a flirt. Keep it playful and never mean.")

# ShadowFlow
sh=[]
for k,nm,key in [("09 Shadow/01 Reflections.pdf","Shadow Reflections","reflections"),("09 Shadow/02 Laws.pdf","Manifestation Laws","laws"),("09 Shadow/03 Affirmations.pdf","Divine Affirmations","affirmations"),("09 Shadow/04 Gratitude.pdf","Unseen Gratitude","gratitude")]:
    cards=[{"text":clean(J(p[1:]))} for p in pages(k)]
    sh.append({"key":key,"name":nm,"cards":dedupe(cards)})
game("shadowflow","ShadowFlow","Use ShadowFlow to learn more about your hidden self.",sh,howTo="Pick a deck, draw a card and take a quiet minute with it. Write down what comes up.")

# WorkFlow
wf=[]
for k,nm,key in [("10 Workflow/01 Finish the Sentence.pdf","Finish the Sentence","finish"),("10 Workflow/02 Confessions.pdf","Confessions","confessions"),("10 Workflow/03 Whats the Fix.pdf","What’s the Fix?","fix"),("10 Workflow/04 Work-Life Balancer.pdf","Work-Life Balancer","balance"),("10 Workflow/05 Rapid Fire.pdf","Rapid Fire","rapid"),("10 Workflow/06 Truth or Truth.pdf","Truth or Truth","truth"),("10 Workflow/07 Two Truths and a Lie.pdf","Two Truths and a Lie","twotruths")]:
    cards=[]; hint=None
    for p in pages(k):
        body=p[1:]; hint=clean(body[-1]) if body else None; main=body[:-1]
        c={"text":clean(J(main))}
        m=re.findall(r'\(\d\)\s*([^()]+?)(?=\s*\(\d\)|$)',c["text"])
        if m: c["list"]=[clean(x) for x in m]; c["text"]=""
        cards.append(c)
    deck={"key":key,"name":nm,"cards":dedupe(cards)}
    if key not in("truth","twotruths") and hint: deck["hint"]=hint
    wf.append(deck)
game("workflow","WorkFlow","Reveal the hidden secrets of office culture.",wf,howTo="Pick a deck and take turns drawing a card. Flip it to see how that deck is played.")
json.dump(out,open(sys.argv[2],"w"),ensure_ascii=False,indent=1)
for k,g in out.items():
    print(k,[(x["key"],len(x["cards"])) for x in g["decks"]])
print([ (x["key"],x["cover"],len(x["cards"])) for x in rp])
print(len(json.dumps(out,ensure_ascii=False))//1024,"KB")
