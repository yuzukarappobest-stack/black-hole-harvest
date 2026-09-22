window.MUSHI_DATA = (() => {
  const A=(name,power,effect=null,text='',extra={})=>({name,power,effect,text,...extra});
  const insect=(id,name,color,cost,hp,attacks,passive=null,set='booster1')=>({id,name,type:'insect',color,cost,hp,attacks,passive,set});
  const enhance=(id,name,cost,effectText,effect,set='booster1')=>({id,name,type:'enhance',color:null,cost,effectText,effect,set});
  const spell=(id,name,cost,effectText,effect,set='booster1')=>({id,name,type:'spell',color:null,cost,effectText,effect,set});
  const basic=(id,name,color,cost,hp,power,set='booster1')=>insect(id,name,color,cost,hp,[A('攻撃',power)],null,set);

  const cards={};

  // 赤の虫 1-33
  cards[1]=insect(1,'ニセハナマオウカマキリ','red',6,1600,[A('神のカマ連撃',300,'mantisCombo','攻撃後、相手の場に虫がいればもう1度だけ使用できる。'),A('共食い',2000,'cannibal','使うとき、この虫以外の自分の虫を1つ破壊する。')]);
  cards[2]=insect(2,'リオック','red',5,800,[A('かみちぎる',600)],{type:'altSacrifice2',text:'＜エサにする＞ コストの代わりに自分の場の虫2つを破壊して出せる。'});
  cards[3]=basic(3,'メキシカンレッドニー','red',5,1400,700);
  cards[4]=basic(4,'オニヤンマ','red',5,1200,900);
  cards[5]=insect(5,'トビズムカデ','red',5,1300,[A('キバ',700),A('毒のキバ',500,'persistentDamage','このダメージはターン終了時に回復しない。')]);
  cards[6]=insect(6,'ギンヤンマ','red',5,1100,[A('とびかかる',700)],null,'starter');
  cards[7]=insect(7,'オオカマキリ','red',4,800,[A('カマ連撃',200,'mantisCombo','攻撃後、相手の場に虫がいれば、もう一度だけ使用できる。'),A('共食い',800,'cannibal','使うとき、この虫以外の自分の虫を1つ選び、破壊する。')],null,'starter');
  cards[8]=insect(8,'オオスズメバチ','red',4,800,[A('かみきる',500),A('毒針',800,'oncePerEntry','この技は場にいる間1度だけ使用できる。')]);
  cards[9]=insect(9,'ヤブキリ','red',4,600,[A('攻撃',400)],{type:'flyOut',text:'＜とびだす＞ 縄張りから引いたとき、コストなしで場に出せる。'});
  cards[10]=insect(10,'ミイデラゴミムシ','red',4,700,[A('攻撃',400)],{type:'poisonMist',text:'＜毒霧噴射＞ 虫の攻撃で破壊されたとき、破壊した虫を手札に戻す。'});
  cards[11]=insect(11,'コオニヤンマ','red',4,800,[A('とびかかる',500)],null,'starter');
  cards[12]=basic(12,'チョウセンカマキリ','red',4,800,600);
  cards[13]=insect(13,'シオヤアブ','red',4,800,[A('さす',500),A('吸血',200,'hpNextTurn','次の相手のターン、この虫の体力を200増やす。',{value:200})]);
  cards[14]=insect(14,'デスストーカー','red',3,800,[A('きりきざむ',200),A('毒針',600,'oncePerEntry','この技は場にいる間1度だけ使用できる。')]);
  cards[15]=insect(15,'アリジゴク','red',3,700,[A('はさみつく',300),A('アリ地獄',0,'sourceAttackLock','次の相手のターン、この虫が場にいる間、対象は攻撃できない。')]);
  cards[16]=insect(16,'キリギリス','red',3,800,[A('かみちぎる',100)],{type:'taunt',text:'＜鳴く＞ 相手はこの虫以外を攻撃できない。'});
  cards[17]=insect(17,'マイマイカブリ','red',3,400,[A('かみつぶす',300)],{type:'flyOut',text:'＜とびだす＞ 縄張りから引いたとき、コストなしで場に出せる。'});
  cards[18]=insect(18,'コガネグモ','red',3,600,[A('かむ',400),A('蜘蛛の糸',0,'sourceAttackLock','次の相手のターン、この虫が場にいる間、対象は攻撃できない。')]);
  cards[19]=basic(19,'オニグモ','red',3,700,300);
  cards[20]=insect(20,'ハラビロカマキリ','red',3,600,[A('カマ斬撃',400),A('共食い',600,'cannibal','使うとき、この虫以外の自分の虫を1つ破壊する。')]);
  cards[21]=insect(21,'ヒアリ','red',2,400,[A('毒針',0,'dynamicPower','自分の赤のエサ1枚につき攻撃力200。',{dynamic:'redBait200'})]);
  cards[22]=insect(22,'セアカゴケグモ','red',2,400,[A('かむ',100),A('毒針',400,'oncePerEntry','この技は1度だけ使用できる。')],null,'starter');
  cards[23]=insect(23,'クロシデムシ','red',2,400,[A('死骸の山',0,'dynamicPower','自分の捨て札1枚につき攻撃力100。',{dynamic:'discard100'})]);
  cards[24]=insect(24,'アキアカネ','red',2,500,[A('とびかかる',200)],null,'starter');
  cards[25]=basic(25,'シオカラトンボ','red',2,300,300);
  cards[26]=basic(26,'ハンミョウ','red',2,400,300);
  cards[27]=insect(27,'ミツツボアリ','red',1,200,[A('かみつく',100)],{type:'honey',text:'＜蜜をためる＞ 場に出たとき、手札1枚をエサにしてよい。このターンそのエサのコストは発生しない。'});
  cards[28]=basic(28,'ナナホシテントウ','red',1,300,200);
  cards[29]=insect(29,'クロヤマアリ','red',1,300,[A('アリの大群',0,'dynamicPower','自分の場の虫1つにつき攻撃力100。',{dynamic:'field100'})]);
  cards[30]=insect(30,'ナミテントウ','red',1,300,[A('かみつぶす',100)],null,'starter');
  cards[31]=basic(31,'ハナグモ','red',1,200,200);
  cards[32]=insect(32,'コカマキリ','red',1,200,[A('カマ斬撃',200),A('共食い',300,'cannibal','使うとき、この虫以外の自分の虫を1つ破壊する。')]);
  cards[33]=basic(33,'クロオオアリ','red',1,400,100);

  // 青の虫 34-66
  cards[34]=insect(34,'ヘラクレスオオカブト','blue',6,1600,[A('神のツノ突進',1000),A('ヘラクレス投げ',0,'bounceOnce','相手の虫を手札に戻す。この技は場にいる間1度だけ使用できる。')]);
  cards[35]=insect(35,'コーカサスオオカブト','blue',5,1200,[A('ツノ突進',800),A('すくい投げ',0,'flip','相手の虫をターン終了時まで裏返す。')]);
  cards[36]=basic(36,'ミヤマクワガタ','blue',4,900,700);
  cards[37]=insect(37,'ゴライアスオオツノハナムグリ','blue',5,800,[A('ふみつぶす',500)],{type:'flyOut',text:'＜とびだす＞ 縄張りから引いたとき、コストなしで場に出せる。'});
  cards[38]=basic(38,'ギラファノコギリクワガタ','blue',5,1200,900);
  cards[39]=insect(39,'ニシキオオツバメガ','blue',4,1000,[A('すする',300),A('虹色光沢',0,'rainbowColor','相手の場の虫すべてを、このターン選んだ色にする。')]);
  cards[40]=insect(40,'カブトムシ','blue',4,800,[A('ツノ突進',500),A('すくい投げ',0,'flip','相手の虫を1つ選び、ターン終了時まで裏返す。裏返しの間はいないものとして扱う。')],null,'starter');
  cards[41]=basic(41,'オオクワガタ','blue',5,1300,800);
  cards[42]=basic(42,'オオムラサキ','blue',4,1000,400);
  cards[43]=basic(43,'ヒラタクワガタ','blue',4,800,600);
  cards[44]=insect(44,'ナミアゲハ','blue',4,1100,[A('すいつくす',300)],{type:'pollen',text:'＜りんぷん＞ 相手はこれ以外の虫を攻撃できない。'},'starter');
  cards[45]=basic(45,'アオスジアゲハ','blue',3,700,300);
  cards[46]=basic(46,'ノコギリクワガタ','blue',3,600,400);
  cards[47]=insect(47,'ミンミンゼミ','blue',3,500,[A('しぼりとる',200)],{type:'flyOut',text:'＜とびだす＞ 縄張りから引いたとき、条件を満たせばコストなしで場に出せる。'},'starter');
  cards[48]=basic(48,'クロアゲハ','blue',3,700,200);
  cards[49]=basic(49,'オオゾウムシ','blue',3,800,200);
  cards[50]=basic(50,'オオスカシバ','blue',3,400,500);
  cards[51]=basic(51,'ヤエヤママルバネクワガタ','blue',3,500,400);
  cards[52]=basic(52,'クマゼミ','blue',3,700,300);
  cards[53]=insect(53,'セイヨウミツバチ','blue',2,500,[A('ハチダマアタック',200),A('決死の一撃',300,'selfDestruct','ダメージを与えた後、この虫を破壊する。')]);
  cards[54]=insect(54,'キムネクマバチ','blue',2,400,[A('かみきる',200),A('毒針',300,'oncePerEntry','この技は場にいる間1度だけ使用できる。')]);
  cards[55]=basic(55,'コクワガタ','blue',2,400,300);
  cards[56]=basic(56,'アブラゼミ','blue',2,500,200);
  cards[57]=basic(57,'アカタテハ','blue',2,400,200);
  cards[58]=basic(58,'アカアシクワガタ','blue',2,300,300);
  cards[59]=basic(59,'ヘビトンボ','blue',2,500,100);
  cards[60]=insect(60,'ニホンミツバチ','blue',1,400,[A('ハチダマアタック',100),A('決死の一撃',200,'selfDestruct','ダメージを与えた後、この虫を破壊する。')]);
  cards[61]=insect(61,'モンシロチョウ','blue',1,300,[A('すいとる',100)],{type:'emblem',partner:'モンキチョウ',value:300,text:'＜紋章＞ 自分の場にモンキチョウがいれば攻撃力+300。'});
  cards[62]=insect(62,'モンキチョウ','blue',1,300,[A('すいとる',100)],{type:'emblem',partner:'モンシロチョウ',value:300,text:'＜紋章＞ 自分の場にモンシロチョウがいれば攻撃力+300。'});
  cards[63]=insect(63,'カナブン','blue',1,300,[A('たいあたり',100)],null,'starter');
  cards[64]=insect(64,'ヒグラシ','blue',2,200,[A('しぼりとる',200)],null,'starter');
  cards[65]=basic(65,'ネブトクワガタ','blue',1,400,100);
  cards[66]=basic(66,'アオカナブン','blue',1,300,200);

  // 緑の虫 67-99
  cards[67]=basic(67,'オオキバウスバカミキリ','green',6,1700,1200);
  cards[68]=insect(68,'テナガカミキリ','green',5,1200,[A('キバ無双',800),A('テナガ攻撃',300,'multiTwo','相手の虫を2つ選び、順番に300ダメージずつ与える。')]);
  cards[69]=basic(69,'ジャイアントウェタ','green',5,1300,800);
  cards[70]=insect(70,'シロスジカミキリ','green',5,1300,[A('くいちぎる',700),A('首を鳴らす',300,'hpNextTurn','次の相手のターン、この虫の体力+300。',{value:300})]);
  cards[71]=insect(71,'トノサマバッタ','green',5,1200,[A('くらいつく',700)],null,'starter');
  cards[72]=insect(72,'オオコノハムシ','green',4,800,[A('かぶりつく',600)],{type:'mimic',text:'＜擬態＞ 場に出た次の相手のターンに攻撃を受けない。'});
  cards[73]=insect(73,'サバクトビバッタ','green',4,1000,[A('くらいつくす',400,'directBaitReturn','直接攻撃したとき、相手はエサ1枚を手札に戻してから縄張りを引く。')]);
  cards[74]=insect(74,'ゴマダラカミキリ','green',4,700,[A('くいちぎる',300)],{type:'flyOut',text:'＜とびだす＞ 縄張りから引いたとき、コストなしで場に出せる。'});
  cards[75]=insect(75,'クワカミキリ','green',4,800,[A('くいちぎる',600),A('首を鳴らす',200,'hpNextTurn','次の相手のターン、この虫の体力+200。',{value:200})]);
  cards[76]=insect(76,'キアゲハ（幼虫）','green',4,900,[A('かじる',400),A('くさいツノ',0,'stinkHorn','相手の虫の次のターンの攻撃力を600下げる。',{value:600})]);
  cards[77]=basic(77,'ショウリョウバッタ','green',4,900,500);
  cards[78]=insect(78,'ヤマトタマムシ','green',3,600,[A('くいあらす',200),A('虹色光沢',0,'rainbowColor','相手の場の虫すべてを、このターン選んだ色にする。')]);
  cards[79]=insect(79,'ナミアゲハ（幼虫）','green',3,700,[A('かじる',200),A('くさいツノ',0,'stinkHorn','相手の虫を1つ選ぶ。次のターン、その虫の攻撃力を400下げる。',{value:400})],null,'starter');
  cards[80]=insect(80,'ナナフシモドキ','green',3,400,[A('かぶりつく',400)],{type:'mimic',text:'＜擬態＞ 場に出た次の相手のターンに攻撃を受けない。'},'starter');
  cards[81]=basic(81,'クロカタゾウムシ','green',3,1000,200);
  cards[82]=basic(82,'オオムラサキ（幼虫）','green',3,700,300);
  cards[83]=insect(83,'イボバッタ','green',3,400,[A('はねる',300)],{type:'flyOut',text:'＜とびだす＞ 縄張りから引いたとき、コストなしで場に出せる。'});
  cards[84]=insect(84,'コバネイナゴ','green',2,400,[A('はねる',200),A('イナゴの大群',400,'baitSacrifice','使うとき、自分のエサ1枚を破壊する。')]);
  cards[85]=insect(85,'アオクサカメムシ','green',2,400,[A('くいつく',200)],{type:'poisonMist',text:'＜毒霧噴射＞ 虫の攻撃で破壊されたとき、破壊した虫を手札に戻す。'});
  cards[86]=insect(86,'オトシブミ','green',2,600,[A('くいつく',100),A('ゆりかご',0,'hpNextTurn','次の相手のターン、この虫の体力+200。',{value:200})]);
  cards[87]=insect(87,'ゴマダラオトシブミ','green',2,500,[A('くいつく',200),A('ゆりかご',0,'hpNextTurn','次の相手のターン、この虫の体力+200。',{value:200})]);
  cards[88]=basic(88,'イラガ（幼虫）','green',2,400,300);
  cards[89]=basic(89,'コガネムシ','green',2,500,200);
  cards[90]=basic(90,'ウバタマムシ','green',2,600,100);
  cards[91]=insect(91,'ニジュウヤホシテントウ','green',2,300,[A('かみつぶす',300)],null,'starter');
  cards[92]=insect(92,'チャバネアオカメムシ','green',1,200,[A('くいつく',100)],{type:'poisonMist',text:'＜毒霧噴射＞ 虫の攻撃で破壊されたとき、破壊した虫を手札に戻す。'});
  cards[93]=insect(93,'オンブバッタ','green',1,300,[A('はねる',100),A('おんぶ',0,'moveEnhanceAttack','この虫の強化カード1枚を別の自分の虫につけ替える。')]);
  cards[94]=basic(94,'カイコ（幼虫）','green',1,400,100);
  cards[95]=insect(95,'ワタアブラムシ','green',1,300,[A('すう',100)],null,'starter');
  cards[96]=basic(96,'マメコガネ','green',1,300,200);
  cards[97]=insect(97,'ハラヒシバッタ','green',1,300,[A('はねる',100)],{type:'mimic',text:'＜擬態＞ 場に出た次の相手のターンに攻撃を受けない。'});
  cards[98]=basic(98,'ツマグロオオヨコバイ','green',1,200,200);
  cards[99]=insect(99,'オオミノガ（幼虫）','green',1,300,[A('くいつく',100),A('ミノにこもる',0,'hpNextTurn','次の相手のターン、この虫の体力+200。',{value:200})]);

  // 強化カード
  cards[100]=enhance(100,'雀蜂の毒針',1,'この虫の攻撃力を500増やす。','attack500');
  cards[101]=enhance(101,'玉虫色の羽化',2,'この虫の色を赤か青か緑に変える。','changeColor','starter');
  cards[102]=enhance(102,'空蝉の皮鎧',2,'この虫が破壊されるとき、代わりにこのカードを破壊し、この虫を回復する。','substituteArmor');
  cards[103]=enhance(103,'蚕玉の加護',1,'この虫の体力を800増やす。','hp800');
  cards[106]=enhance(106,'針金虫の道連れ',0,'虫の攻撃によってこの虫が破壊されたとき、この虫を破壊した虫を破壊する。','revenge','starter');
  cards[107]=enhance(107,'天牛の大顎',0,'この虫の攻撃力を300増やす。','attack300','starter');
  cards[108]=enhance(108,'蓑虫の隠れ蓑',0,'この虫の体力を500増やす。','hp500','starter');
  cards[109]=enhance(109,'鳳蝶の蠱惑',0,'相手はこの虫以外を攻撃できない。','tauntAttachment');
  cards[110]=enhance(110,'不滅の王台',0,'この虫が自分の場にいる間、自分は縄張りを引かない。','noTerritory');
  cards[111]=enhance(111,'鋏虫の芯切り鋏',0,'この虫の攻撃で相手が縄張りを引くとき、＜とびだす＞を使えない。','blockFlyOut');
  cards[112]=enhance(112,'剣の息吹',0,'この虫を赤にする。','setRed');
  cards[113]=enhance(113,'勾玉の息吹',0,'この虫を青にする。','setBlue');
  cards[114]=enhance(114,'鏡の息吹',0,'この虫を緑にする。','setGreen');

  // 術カード
  cards[104]=spell(104,'螻蛄の七芸',0,'自分の虫についている強化カード1枚を、別の自分の虫につけ替える。','moveEnhance');
  cards[105]=spell(105,'蜜蝋の壁',0,'このカードを表向きで自分の縄張りに置く。引いたときは捨て札に置く。','addTerritory');
  cards[115]=spell(115,'蟷螂の構え',3,'攻撃済みの自分の虫を1つ選び、もう一度攻撃できるようにする。','readyAttack');
  cards[116]=spell(116,'瀬戸際の虫時雨',4,'自分のエサ場から同じ色の虫を2つまで場に出す。ターン終了時に破壊する。','baitRushTwo');
  cards[117]=spell(117,'退魔の蚊遣り火',3,'相手の虫を1つ選び、破壊する。','destroyOpponent');
  cards[118]=spell(118,'虹の架け橋',1,'自分の捨て札の虫を1つ選び、手札に加える。','recoverInsect','starter');
  cards[119]=spell(119,'蠱毒の因果',2,'山札の一番上を公開する。虫なら場に出しターン終了時に破壊、虫以外なら手札に加える。','topDeckSummon');
  cards[120]=spell(120,'叛逆の蛮勇',1,'自分の捨て札の虫と場の虫を1つずつ入れ替える。出した虫はこのターン攻撃できない。','swapDiscardField');
  cards[121]=spell(121,'斑猫の手招き',0,'自分のエサ場の虫を1つ選び、手札に戻す。','baitToHand');
  cards[122]=spell(122,'百足の狂乱',1,'このターン、自分の場の虫すべての攻撃力を300増やす。','allAttack300');
  cards[123]=spell(123,'蜉蝣の閃き',1,'自分のエサ場の虫を1つ場に出す。ターン終了時に破壊する。','baitTempSummon');
  cards[124]=spell(124,'塵芥虫の爆熱弾',1,'相手の虫を1つ選び、600ダメージを与える。','burn600','starter');
  cards[125]=spell(125,'玉響の蠢き',1,'手札の虫を1つ場に出す。ターン終了時に破壊する。','handTempSummon');
  cards[126]=spell(126,'繚乱の足掻き',0,'同じコストの自分の手札の虫と場の虫を入れ替える。出した虫はこのターン攻撃できない。','sameCostSwap');
  cards[127]=spell(127,'蟲の息吹',1,'これを自分のエサ場に置く。※このエサのコストはこのターン発生しない。','baitBoost','starter');
  cards[128]=spell(128,'埋葬虫の野辺送り',0,'相手の虫についている強化カードを1枚選び、破壊する。','destroyEnhance');
  cards[129]=spell(129,'飛蝗の凶相',0,'このターン、自分の場の虫すべての攻撃力を200増やす。','allAttack200','starter');
  cards[130]=spell(130,'蟲封じの蛍袋',0,'相手の虫を1つ選ぶ。次のターン、その虫は攻撃できない。','blockAttackNext');

  const booster1Ids=Object.values(cards).filter(c=>c.set==='booster1').map(c=>c.id).sort((a,b)=>a-b);
  const decks={
    kabuto:{name:'カブトムシデッキ',ids:[6,6,40,40,44,44,79,79,91,91,24,24,30,30,63,63,108,124,127,129]},
    mantis:{name:'オオカマキリデッキ',ids:[71,71,7,7,11,11,47,47,80,80,22,22,64,64,95,95,106,107,101,118]},
    random1:{name:'ランダム（第1弾）',ids:booster1Ids,randomCount:20}
  };

  return {cards,decks,booster1Ids};
})();