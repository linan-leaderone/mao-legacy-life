import {tidyLocalProse} from './narrative.js';
import {continuityNarrative} from './continuity.js';

// These two named openings are deliberate fiction. Ordinary lives never enter them.
export const SPECIAL_KINDS=['mao_resurrection','deng_ocean'];
const bodies={mao_resurrection:['preserved','recovering','human'],deng_ocean:['small_fish','predator','giant_fish','sea_creature','amphibious','human']};
const bound=(value,min,max)=>Math.max(min,Math.min(max,value));
const intent=text=>String(text||'').split(/[，。；,;\n]/).filter(t=>!/(?:不想|不打算|不准备|不会|不再|不要|不吃|不捕食|不吞噬|停止|不复活|不上岸|不化形|不变成人|拒绝|放弃|没有|只了解|仅了解|如果|考虑是否)/.test(t)).join('，');
const regularBody=s=>s.specialLife?.body==='human';
const modulo=(value,base)=>(value%base+base)%base;
const date=m=>`${2020+Math.floor(m/12)}年${modulo(m,12)+1}月`;
const completedTurns=s=>Number.isInteger(s.turn)?s.turn:Array.isArray(s.history)?s.history.length:Math.max(0,s.month||0);
const oceanBodies=['small_fish','predator','giant_fish','sea_creature'];
const validHarvest=value=>value&&typeof value==='object'&&!Array.isArray(value)&&[['eaten',500],['growth',20],['elapsedMs',45000]].every(([key,max])=>Number.isInteger(value[key])&&value[key]>=0&&value[key]<=max);
function harvestFor(s,action,text){
  if(!action.meta||!Object.hasOwn(action.meta,'fishGame'))return null;
  if(s.specialLife?.kind!=='deng_ocean'||!oceanBodies.includes(s.specialLife.body)||action.passive||!/吞噬|捕食|吃(?:掉|些|点|小鱼|鱼|猎物)|觅食/.test(text)||!validHarvest(action.meta.fishGame))throw new Error('这次觅食的记录不完整，请重新安排。');
  const value=action.meta.fishGame;
  return {eaten:value.eaten,growth:value.eaten?value.growth:0,elapsedMs:value.elapsedMs};
}
const stages={
  mao_resurrection:['棺内苏醒','传出回应','身体恢复','重新生活','面对公众'],
  deng_ocean:['洋流中的小鱼','追逐鱼群','深水中的大鱼','远洋生物','海岸与陆地']
};

const sceneHash=value=>{let h=2166136261;for(const c of String(value))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
// These scenes change what receives attention, not the recorded body, growth,
// catch or public exposure. A quiet month never creates a new physical ability.
const quietScenes={
  mao_0:[
    ['shift','交班时的声音','你辨认出交班时几种不同的声音，知道身边的值守人员换了班。','玻璃外有人交接工作，一人读日期，一人核对当天的安排。你听见一个新声音问起之前的记录，熟悉的值守人员向他作了说明。你听完交谈，记住了这次接触中能够分辨的细节。'],
    ['clock','夜间的间隔','夜间的脚步停歇后，你开始留意房间里规律出现的声响。','夜里来往的人少了，门外隔一段时间会响起脚步。你把脚步和设备运转的声音分开辨认，等待照看的人靠近。白天听过的几句话仍记得清楚，你把想询问的事情留在心里。'],
    ['radio','断续传来的广播','附近传来一段广播，你记住了里面的日期和几个陌生词。','值守人员交谈时提到刚听过的广播，一段消息透过玻璃传进来。你能理解其中一些内容，对另一些词还不熟悉。有人走近查看时，你把注意力转回眼前，等待能够继续表达的时机。'],
    ['light','光线改变的时候','室内灯光调整后，你重新辨认近处人影的位置。','工作人员调整了室内照明，玻璃上映出的轮廓跟着移动。你注意到固定停留在近处的人换了位置，外界声音的方向也不同了。这次变化让你更清楚谁正站在身边，现有的回应方式仍然有效。'],
    ['memory','记得的一件往事','一段熟悉的谈话让你想起旧事，你把过去的记忆与眼前的声音分开整理。','有人在附近提到一个你熟悉的地名，你想起在那里见过的人。往事中的情景和现在房间里的交谈并不相同，你知道自己仍在这里。你留心听完后面的几句话，希望弄清那个地方如今有什么变化。'],
    ['quiet','短暂安静的白天','这次白天少有人经过，你把注意力放在能够感知的细节上。','平常会出现的交谈声停了一阵，过道上只有偶尔的脚步。你保持现有姿势，分辨从不同方向传来的动静。照看的人靠近时，你认出他的说话方式，继续沿用之前已经试过的回应。']
  ],
  mao_1:[
    ['questions','几个可以回答的问题','值守人员把问题缩短，你用已有的回应方式表达了几项偏好。','对方这次只问是否需要安静、是否希望继续听读。你按之前约好的方式作答，他把答复记下，没有反复问同一个问题。之后有人靠近时，先看这些记录，再决定怎样与你交流。'],
    ['old_place','报刊上的旧地名','读报的人讲到一个熟悉地方的近况，你把注意力留在这条消息上。','值守人员读到一个你记得的地方，停下来解释如今的名称和情况。你通过既有反应表示还想听，他翻回那一段重新读清楚。当天的交流围绕这条消息展开，先前回答过的基本问题不再重问。'],
    ['voice','换了一位读报的人','新的值守人员调整了读报速度，你逐渐听清他讲的内容。','这次读报的人语速较快，熟悉你回应方式的同事提醒他停顿。他放慢后，你能把各条消息分开听完。交接时，两人把适合交流的节奏写进记录，之后的问答省去了几次重复。'],
    ['rest','照看的时间调整了','身边的人根据已经表达的需要，调整了一次交流和休息的时间。','原定读报时，房间外正有人交接。照看的人把读报挪到安静些的时候，先让你休息。你后来听完当天的几条消息，依照已有方式表示是否继续，这个小调整就此沿用了下来。'],
    ['calendar','核清眼前的日期','值守人员把年月和星期说清楚，你将它们与已知的消息对应起来。','你听到几次不同时间的新闻，照看的人发现需要先说明它们分别发生在哪一天。他重新读了一遍日历，注明哪些是旧报道。之后再讲消息时，他先报日期，你也更容易分清先后。'],
    ['preference','一本书留了下来','读过的一段书引起了你的注意，值守人员把书留在近处，等待下次继续。','对方读到一段你熟悉的文字，你按约定方式作出回应。他问是否保留这本书，得到答复后夹上书签。当天没有重新解释你的身份，接下来的阅读有了明确的起点。']
  ],
  mao_2:[
    ['reading','读到不同的说法','你听取了两份对同一件事说法不同的材料，提出需要补充的背景。','送来的材料讲的是同一件事，用词和重点有所不同。你在现有说话能力内指出不明白的地方，请身边的人说明消息来自哪里。对方把出处补在纸上，这次交流留下的是具体问题，常规照护仍按原有安排进行。'],
    ['routine','一天的时间怎样用','你和照护人员商量，把阅读与交流安排在自己比较有精力的时候。','原先几项安排挤在一起，你提出希望分开。照护人员根据已有的照护要求调整顺序，保留休息时间。你把精神较好的那一段用来听消息和表达意见，没有勉强增加活动量。'],
    ['object','手边的小物件','你开始留意床边常用物件的摆放，向照护人员说明自己使用时的困难。','纸张和水杯放在不同位置，你按当前活动能力试着靠近。能够自己完成的部分由你处理，其余请照护人员协助。他们重新摆好物件，几项日常需要因此更方便，身体能力仍以已经恢复的程度为准。'],
    ['conversation','听照看的人谈日常','一位照护人员谈起普通人的日常，你根据自己听得懂的部分追问了几句。','对方在休息间隙说起交通、食物和工作时间。你挑其中一件不熟悉的事问下去，他用自己的经历作了说明。谈话只发生在已经接触的人之间，外界并没有因此得知这里的情况。'],
    ['names','同名的地方与陌生的变化','你在材料里发现几个旧名字，了解到它们如今的用途已有变化。','照护人员把地图放在便于看清的位置，说明几个地方如今的名称。你认出其中一部分，对新出现的道路和设施还需要解释。当天留下的问题集中在这些地方，之后可以沿着材料继续了解。'],
    ['choice','保留一点自己的时间','你提出留出一段不用交流的时间，照护人员按已有条件作了安排。','检查与照护照常进行，其余时间没有人不停地向你提问。你翻看先前已经读过的材料，记住还想弄清楚的地方。再次交流时，你从其中选了一个问题谈，没有把之前的检查重新讲一遍。']
  ],
  mao_3:[
    ['appliance','一件日常用品','你向已接触的照护人员请教一件日常用品的用法。','在安排好的生活范围内，你注意到一件过去没有用过的东西。熟悉的人演示了它的用法，你试着完成其中简单的步骤。会面与休息仍按自己的需要安排，这件小事让如今的日常生活具体了一些。'],
    ['meal','餐桌上的闲谈','吃饭时的一段交谈，让你了解到身边人怎样安排工作和家庭。','你与已经认识的人谈起常吃的食物，他顺带说到家里的作息。你问了几句实际开支和来往交通，对方只说自己知道的情况。饭后，对方收拾好桌面，把你还想了解的事情留给下次闲谈。'],
    ['archive','找到一份旧记录','你在可取得的材料里读到一份旧记录，决定先核对其中的具体内容。','记录中的几个名字你仍记得，对一些时间和细节有自己的看法。你把想核对的地方标出来，请原来负责联络的人寻找补充资料。能够确认的部分先留下，暂时没有材料的地方不急着下结论。'],
    ['schedule','腾出来的一个下午','原定安排提前结束，你把空出的时间用于休息和自己想读的东西。','送来的材料比预想少，你看完后没有继续安排会面。你在允许活动的地方走了一段，回去挑一本自己愿意读的书。照看的人把书放到手边，让你自己决定什么时候继续阅读。'],
    ['differences','一次没有谈拢的讨论','你与原来认识的一位接待人员交换意见，双方把没有谈拢的问题留了下来。','谈到一项现实安排时，你们对它的作用看法不同。对方说明自己接触过的情况，你提出另一个考虑。谈话结束时没有强求一致，之后是否再谈取决于新材料和双方意愿。'],
    ['requests','选择自己愿意了解的事','你从现有材料中选出一件关心的日常问题，交给原来的联络人员询问。','资料中的大标题很多，你这次只问一个具体问题：普通人处理这类事情时会遇到什么。联络人员记下范围，先用已经掌握的情况回答。对方把答复交给你，说明其中哪些来自亲身经历。']
  ],
  mao_4:[
    ['letters','来信里的不同期待','公开消息带来几种不同的来信，你选择回应其中一件具体事情。','有来信表达激动，也有人担心公开活动会改变现有生活。你把带有具体问题的信挑出来，按现有精力作答。你只回复自己了解的部分，留下希望以后继续谈的话题。'],
    ['interview','采访前的几个问题','对方送来采访提纲，你删去暂时不愿回答的部分，说明愿意谈的范围。','提纲里既有过去的事情，也有对眼下局势的追问。你先看清哪些问题需要查资料，哪些属于自己的生活。接待人员据此向对方说明安排，公开活动的时间仍要与你的日常和身体情况协调。'],
    ['ordinary','来访者谈到的生活','一位已经安排见面的来访者讲起自己的生活，你将讨论放在具体经历上。','对方谈到工作时间和家庭开支，没有马上提出宏大的要求。你询问几个细节，说明自己还有哪些不了解的地方。谈到不同看法时，你们各自说明理由，会面结束后仍有一些问题留待以后再谈。'],
    ['rumor','一条需要核清的说法','外界出现了一条有关你的说法，接待人员与你核对后作了简短说明。','这条说法把你的日常活动写得夸张。你指出其中没有发生的部分，允许联络人员说明可公开的事实。并非所有人立刻接受说明，你把注意力留给自己真正安排过的事情。'],
    ['space','给公开活动留出间隔','你减少了一次原定公开接触，把时间留给休息和已有的个人安排。','来访请求仍在，但你没有全部答应。接待人员按你的决定回复，把可以延后的活动重新排期。有人理解，也有人觉得失望；你的日常不需要每天都围绕这些请求展开。'],
    ['discussion','同一份材料的几种意见','公开讨论中出现不同意见，你选择先读清各自所依据的材料。','支持者引用的事例与质疑者关注的问题并不相同。你请原有联络人员整理原文，避免只看转述。读过之后，你回应其中能够核实的部分，对暂时不清楚的地方保留判断。']
  ],
  ocean_0:[
    ['silt','海底扬起的细沙','一阵水流扬起海底细沙，你换到能看清周围的位置停留。','细沙使近处的轮廓变得模糊，你沿已经辨认过的坡面移动，避开水流最急的位置。沙粒慢慢沉下后，原来的藏身处重新露出来。你记住这次绕行的方向，体型保持现状。'],
    ['shadow','从上方经过的影子','上方出现较大的轮廓，你留在现有遮蔽物附近观察它经过。','那道影子沿另一方向移动，没有停在你附近。你等水里的动静减弱后才离开躲藏处，重新辨认原来的通道。这次经历没有带来捕获，你对可退回的位置更熟悉了。'],
    ['current','水流换了方向','熟悉水域的水流方向改变，你找到了一处适合停留的缓流。','原来经过的一条路需要更费力地游动，你没有一直逆流。沿旁边的坡面绕过后，水流缓和下来，近处的小型生物从另一个方向经过。你停在那里观察，暂时没有追逐。'],
    ['sound','水里的陌生声响','一阵陌生震动传来，你先减少移动，辨认它靠近还是远离。','震动持续了一会儿，随后渐渐减弱。你没有看见声源，只能根据已有感官判断周围的变化。确认近处没有明显动静后，你沿熟悉的范围活动，保持能够退回的距离。'],
    ['shelter','原来的缝隙旁','原先停留的地方多了杂物，你在附近重新选择可以退入的位置。','杂物堵住了原来的一侧入口，另一侧仍能通行。你试着靠近后退，确认按当前体型可以通过，随后留在更便于观察的地方。等水流平缓下来，你从另一侧退回原来的活动范围。'],
    ['rest','缓流里的停留','你在较缓的水流里停留了一段，把注意力放在身边生物经过的方向。','小型生物散开后，周围安静下来，你没有继续追着它们游。偶尔有动静传来时，你靠近已有遮蔽物，等能够看清再调整位置。身体仍保持现有大小，这次停留以休息和观察为主。']
  ],
  ocean_1:[
    ['split','分开的鱼群','附近鱼群分成了两个方向，你观察它们经过的水层，没有急着追上去。','其中一群转向更快，另一群沿坡面散开。你依照当前游动能力保持距离，记住容易返回的路线。它们离开后，你回到原来的停留范围，在水流较缓的位置休息。'],
    ['crossflow','两股水流交汇处','两股水流交汇让移动变得费力，你改从边缘通过。','你原先熟悉的方向在那里发生偏转，靠近时需要不断调整鱼鳍。沿边缘绕过后，水流重新平稳，回程的方向也看得更清楚。现有的肌肉和感官继续发挥作用，身体没有自行变大。'],
    ['territory','被占用的停留点','另一条鱼停在你常用的位置，你换到附近有退路的地方。','对方没有离开，你也没有为了这个位置立即冲上去。沿旁边水层游过后，你发现另一处能够躲开直冲水流的位置。旧的停留点仍在那里，今后是否返回可以再看当时的情况。'],
    ['temperature','较凉的一层水','你经过水温不同的水层，缩短了停留时间，回到较熟悉的范围。','水温变化在移动时逐渐明显，附近生物经过的方向也和原先不同。你先观察一段，再按已有路线返回。后来再次靠近这片水层时，你已经知道从哪里折返。'],
    ['obstacle','通道里的新障碍','一块落下的杂物改变了原先的通道，你从旁边找到了可通过的空隙。','你按当前体型试探空隙，没有勉强挤进过窄的地方。绕过杂物后，原来能停留的缓流仍在。新的路线稍远，你记住它的位置，把余下时间用于休息。'],
    ['distance','看清远近','你在两处熟悉地点之间移动，发现其中一条路线更容易避开较大的鱼。','原来的直线路径经过开阔水层，这次你沿坡面分段移动。遇到动静便停下观察，确认能够返回后再继续。到达另一处停留点时，你记住了沿途几个可躲藏的位置。']
  ],
  ocean_2:[
    ['depth','坡面以下','你沿熟悉坡面下移一段，在当前身体能够适应的深度停了下来。','附近的光线和水流有所不同，生物活动的方向也改变了。你没有继续往陌生深处钻，先记住返回的坡面。回到原来水层后，新的方位留在记忆里，现有体型没有发生变化。'],
    ['vibration','远处的船声','远处传来持续的震动，你调整路线，避开声响较明显的水域。','声音隔一段时间增强，随后又减弱。你只能确认它来自远处，无法据此知道岸上的事情。绕到安静些的位置后，你沿原有水层活动，把这条避让路线记住。'],
    ['space','空出的水层','原先密集的小鱼离开后，一片水层暂时空了下来。','你没有把空处当成能够一直找到食物的地方，先观察水流把生物带向哪里。几次转向后，熟悉的坡面重新出现在附近。你回到便于停留的位置，等待下一次明确安排。'],
    ['return','回程的另一条路','你从另一侧回到熟悉水域，认出几处之前没有注意过的坡面。','这条路的水流较缓，部分地方的宽度只够当前身体通过。你避开狭窄处，保持能够转身的距离。回到原来的活动范围时，来回已经多了一种选择。'],
    ['drift','随水流移动的杂物','一片杂物经过附近，你改变了游动高度，避免被带进狭窄的地方。','杂物在水流转弯处聚到一起，原先的通道变得不好通过。你沿外侧观察，等它们散开一些再过去。没有必要一直和水流对抗，这次移动也没有带来新的进食或成长。'],
    ['pause','较安静的一段水域','你在安静的水层停留，观察周围生物怎样避开你的身形。','近处小鱼会在你转向时散开，远处仍有零星动静。你减少大幅度游动，先看清它们经过的位置。已有的捕食能力没有消失，今天的注意力放在休息和熟悉环境上。']
  ],
  ocean_3:[
    ['open_water','开阔水域的方向','你在开阔水域辨认几股洋流，记住较适合返回的一条。','周围缺少可以贴近的坡面，你依靠已经具有的感官保持方向。水流发生偏转时，你先观察再继续，避免越走越远。回到熟悉范围后，这段经历成为以后选择路线的依据。'],
    ['shoreward','通往海岸的水流','一股水流通向记忆中的海岸方向，你沿它观察一段，没有登陆。','靠近不同水层时，声响和生物分布都在变化。你仍按目前的海中形态活动，在能够辨认回程的位置停下。远处的动静渐渐减弱，你沿记住的水流折返，海岸的方向留在心里。'],
    ['deep_route','深处的通道','你沿当前身体已经能够适应的深度移动，避开一段较狭窄的通道。','通道里的水流比外面快，你没有把身形挤进去。沿外侧绕行后，远处的生物活动重新变得容易分辨。原先的感官和力量继续存在，这次没有出现新的进化。'],
    ['signal','两个方向的动静','两个方向先后传来动静，你停在中间较稳的位置，分清它们的远近。','其中一处很快安静下来，另一处仍断续有变化。你只依据已有感官判断，没有马上追过去。随后你选择可返回的路线离开，记住这片水域容易混淆方向的位置。'],
    ['boundary','陌生水域的边缘','你抵达熟悉水域的边缘，先观察边缘以外的水流，再沿原路返回。','更远处有新的声响，眼前可供辨认的地形较少。你留在能够转身返回的位置，慢慢记住附近的变化。回到原来的活动范围后，你更容易认出那几处容易混淆的方向。'],
    ['still_water','没有追逐的一段时间','你在较稳的水流里休息，保留现有的力量和身体状态。','远处有生物经过，你没有每次都追上去。身体在当前水层能够正常活动，你把移动限制在熟悉范围内。海里的经历仍然留在记忆中，下一次要去哪里有了更明确的参照。']
  ],
  shore_animal:[
    ['tide','退潮后的落脚点','潮位变化后，你挪到仍能返回海水的位置停留。','原先浸在水里的地方露出更多地面，你按照现在能够爬行和呼吸的条件移动。远处有人经过，你留在可退回水中的范围，没有进入居民的住所。'],
    ['lights','岸边灯光的时间','你留意岸边灯光何时亮起，逐渐分清较安静和人多的时段。','一条道路傍晚来往的人较多，之后才慢慢减少。你从现有停留点观察，没有因为看见人群就改变形态。海水和陆地之间的退路仍然保留着。'],
    ['shelter','换一处遮蔽','原来的停留处受到海浪影响，你在附近找了更便于返回海里的位置。','你按当前身体可以通过的宽度移动，没有勉强爬上过高的地方。新的位置能够观察潮水，附近有人时也有空间退开。这里成为临时落脚点，原有形态保持不变。'],
    ['distance','路人的目光','有路人注意到你的形态，你保持距离，没有靠近他们。','对方停下看了一会儿，随后沿原路离开。你留意他们经过的方向，等近处安静下来才改变位置。等脚步声远去，你沿近处较低的地面回到海水旁。'],
    ['path','沿岸的一小段路','你沿岸边走了一小段，确认哪些地方按现在的身体能够通过。','平缓地面和狭窄处交替出现，你选择可以退回的路线。到达前方较开阔的位置后，你记住附近的海面方向，再回到便于停留的地方。'],
    ['weather','岸上的天气变化','岸上天气改变时，你缩短了离开海水的时间。','风和水面动静都比之前明显，你没有一直留在开阔地面。按照当前身体条件，你回到较有遮蔽的位置观察，保留可以进入海水的通道。']
  ],
  shore_human:[
    ['streets','住处附近的路','你辨认了现在所在地区附近几条道路，记住返回原处的方向。','你按已经恢复的人形活动，留意路口和能够辨认的建筑。人们处理自己的日常事务，海里的经历仍在你的记忆中。途中没有发生新的化形，你只是逐渐熟悉眼前的地方。'],
    ['notice','街边的一则告示','你在附近看到一则与当地生活有关的告示，花时间读清上面的安排。','告示提到具体日期和地点，你把能理解的内容与附近环境对应起来。尚不熟悉的词没有妨碍你辨认基本方向。接下来是否前往，仍可以按自己的需要决定。'],
    ['quiet_time','留给自己的时间','你留出一段安静时间，整理已经经历过的事情。','从海中来到岸上的记忆仍然清楚，你没有把它当作需要重新发生的过程。你想起当前可以联系的人和已经确认的生活条件，暂时没有安排新的工作或大笔开支。'],
    ['conversation','听人谈起当地的变化','你听见附近的人谈起当地一件日常变化，留意其中与自己有关的部分。','交谈围绕道路、时间和生活安排展开，路过的人各自说了几句自己的经历。你按照已知的情况理解这些话，记住今后出门可能需要留意的地方。'],
    ['shore_memory','看海的一段时间','你在能够看见海面的地方停留，观察潮水和岸边人来人往。','海中的经历使你认得一些水流变化，眼前仍按已经完成的人形生活。海风从面前吹来，岸边有人沿道路慢慢走过。离开时，你沿刚才走过的路返回。'],
    ['routine','调整日常的顺序','你将眼前几项日常事情换了顺序，给自己留出更多休息时间。','已经明确的生活条件继续有效，不熟悉的部分需要逐件了解。你先处理当天能完成的事，空出的时间用来观察周围环境。到了晚上，已办妥的事情留下记录，其余等自己再作安排。']
  ]
};

function quietScene(s,x=s.specialLife){
  const key=x.kind==='mao_resurrection'?`mao_${x.stage}`:x.stage<4?`ocean_${x.stage}`:x.body==='human'?'shore_human':'shore_animal';
  const pool=quietScenes[key],turn=completedTurns(s),block=Math.floor(turn/pool.length);
  const order=pool.map((row,index)=>({row,index,rank:sceneHash(`${s.seed}:special-quiet:${key}:${block}:${row[0]}`)})).sort((a,b)=>a.rank-b.rank||a.index-b.index);
  const recent=new Set([s.current?.dailyId,...(s.history||[]).slice(-2).map(h=>h.event?.dailyId)]);
  const offset=modulo(turn,pool.length),ordered=[...order.slice(offset),...order.slice(0,offset)];
  const selected=ordered.find(({row})=>!recent.has(`special_${key}_${row[0]}`))||ordered[0];
  const [id,title,summary,narrative]=selected.row;
  return {id:`special_${key}_${id}`,title,summary,narrative};
}

export function initializeSpecialLife(s,persona){
  const kind=persona?.specialScenario;if(!SPECIAL_KINDS.includes(kind))return;
  s.profile.specialScenario=kind;
  s.specialLife={version:1,kind,stage:0,body:kind==='mao_resurrection'?'preserved':'small_fish',experience:0,growth:0,resurrected:false,bodyAge:null,lastAction:'',monthsInBody:0};
  synchronizeSpecialIdentity(s);
}

export function isSpecialLife(s){return SPECIAL_KINDS.includes(s.specialLife?.kind)&&s.profile.specialScenario===s.specialLife.kind;}

export function validateSpecialLife(s,persona){
  const kind=persona?.specialScenario;
  if(!SPECIAL_KINDS.includes(kind)){
    if(s.specialLife||s.profile.specialScenario)throw new Error('这份档案的身体经历与人物不符。');
    return;
  }
  const x=s.specialLife;
  if(!x||s.profile.specialScenario!==kind||x.kind!==kind||x.version!==1||!Number.isInteger(x.stage)||x.stage<0||x.stage>4||!bodies[kind].includes(x.body)||!Number.isInteger(x.experience)||x.experience<0||x.experience>100000||typeof x.resurrected!=='boolean'||!(x.bodyAge===null||(Number.isInteger(x.bodyAge)&&x.bodyAge>=0&&x.bodyAge<=999))||typeof x.lastAction!=='string'||!Number.isInteger(x.monthsInBody)||x.monthsInBody<0||x.monthsInBody>completedTurns(s))throw new Error('这份档案的身体变化记录不完整。');
  if(x.growth!==undefined&&(!Number.isInteger(x.growth)||x.growth<0||x.growth>100000))throw new Error('这份档案的成长记录不完整。');
  if(x.lastFishGame!==undefined&&(kind!=='deng_ocean'||!validHarvest(x.lastFishGame)||(!x.lastFishGame.eaten&&x.lastFishGame.growth)))throw new Error('这份档案的觅食记录不完整。');
  if(kind==='mao_resurrection'&&((x.stage<2&&x.body!=='preserved')||(x.stage===2&&x.body!=='recovering')||(x.stage>=3&&x.body!=='human')||x.resurrected!==(x.stage>=3)))throw new Error('这份档案的苏醒经历互相矛盾。');
  if(kind==='deng_ocean'&&(x.body==='human'||x.body==='amphibious')&&x.stage!==4)throw new Error('这份档案的海岸经历互相矛盾。');
}

export function resolveSpecialAction(s,action,requestedDestination=null){
  if(!isSpecialLife(s))return null;
  const previous=s.specialLife,kind=previous.kind,text=intent(action.label),passive=!!action.passive;
  const harvest=harvestFor(s,action,text);
  const maoRevival=kind==='mao_resurrection'&&/复活|复苏|站起|恢复身体|走出.*(?:水晶棺|纪念堂)|睁开眼/.test(text);
  const maoPublic=kind==='mao_resurrection'&&/公开|见公众|发表讲话|接受采访|电视讲话/.test(text);
  const returnSea=kind==='deng_ocean'&&/回(?:到)?海|返回海|潜回|重返海/.test(text);
  const changeForm=kind==='deng_ocean'&&(/进化|吞噬|吃|捕食|游|潜|登岸|上岸|登陆|陆地|化形|变成人|恢复人形|长出/.test(text)||returnSea);
  if(regularBody(s)&&kind==='mao_resurrection'&&!/恢复身体后重新生活/.test(s.person.occupation))return null;
  if(regularBody(s)&&kind==='deng_ocean'&&!/进化|吞噬|化形|恢复人形|长出/.test(text)&&!returnSea)return null;
  if(regularBody(s)&&!maoRevival&&!maoPublic&&!changeForm)return null;
  const next={...previous,monthsInBody:previous.monthsInBody+1,lastAction:passive?'按现有身体条件生活':tidyLocalProse(action.label).slice(0,500)};
  const capacity=(s.stats.intelligence+s.stats.fitness+s.stats.health)/3;
  const quality=capacity>=45?'smooth':'costly';
  const feeding=kind==='deng_ocean'&&!passive&&/吞噬|捕食|吃|觅食|进化/.test(text);
  const gain=harvest?harvest.growth:kind==='deng_ocean'&&!feeding?0:passive?2:capacity>=45?6:4;
  next.experience=bound(next.experience+gain,0,100000);
  if(harvest){next.growth=bound((previous.growth||0)+harvest.growth,0,100000);next.lastFishGame={...harvest};}
  let summary,delta={stress:passive?-1:1},destination=null;
  if(kind==='mao_resurrection'){
    next.stage=Math.max(previous.stage,next.experience>=30?3:next.experience>=12?2:next.experience>=4?1:0);
    if(!passive&&maoRevival&&!/逐渐|尝试|研究|准备|慢慢/.test(text))next.stage=Math.max(next.stage,3);
    if(!passive&&maoPublic&&previous.stage>=3)next.stage=4;
    next.body=next.stage>=3?'human':next.stage===2?'recovering':'preserved';
    next.resurrected=next.stage>=3;next.bodyAge=next.resurrected?(previous.resurrected&&Number.isInteger(previous.bodyAge)?previous.bodyAge:45):null;
    if(next.stage>=3&&previous.stage<3){
      summary='你设法让值守人员确认了自己的回应。照护人员将你转入封闭的恢复室，反复检查逐渐恢复的呼吸、体温和肌肉活动。持续照护使身体恢复到能够独立行走的程度，你亲自说出姓名，要求了解现在的年月，完成了从棺内苏醒到重新生活的过程。';
      delta={health:10,fitness:8,connections:3,influence:2,stress:2};
      destination='北京';
    }else if(next.stage===4&&previous.stage<4){
      summary='你通过照护人员联系负责接待的人，安排了一次有记录的公开会面。你回答有关身份和近况的问题，提出接下来想做的事。消息开始传到外界，有人要求查证，也有人提出会面请求。现有政府的职务安排继续存在，你需要具体争取合作和支持。';
      delta={influence:8,connections:4,stress:3};
    }else if(passive){
      summary=next.stage<2?'你留意玻璃外的声音，反复尝试控制手指。值守人员记录了新出现的微小反应，重新安排了检查。':next.stage===2?'你按照照护人员的安排休息，尝试说话和活动手臂。呼吸与身体反应有了可确认的改善，身边开始有人定时记录你的要求。':'你在照护安排下练习行走和阅读，了解自己离世之后的生活变化，身体逐渐适应新的日常。';
      delta={health:2,fitness:1,stress:-1};
    }else{
      const bridge=next.stage<2?'你通过反复出现的指尖反应和视线变化向值守人员传达意图。工作人员记录了你的要求，能经手的事项已经开始办理。':next.stage===2?'你在照护人员帮助下说出要求，完成可以由身边人配合的事情。身体仍需要检查，已经做成的安排留下了记录。':'你利用恢复期间建立的联系处理自己的安排，相关人员逐项落实了能够协作的工作。身体变化和身份查证仍有人跟进。';
      summary=`你把“${tidyLocalProse(action.label).slice(0,160)}”作为这个月要办的事。${bridge}`;
      delta={health:2,connections:1,stress:quality==='costly'?3:1};
    }
  }else{
    if(!harvest&&!passive&&/吞噬|捕食|吃/.test(text))next.experience=bound(next.experience+(capacity>=45?8:5),0,100000);
    next.stage=Math.max(previous.stage,next.experience>=48?3:next.experience>=24?2:next.experience>=8?1:0);
    const shore=requestedDestination&&requestedDestination!=='太平洋'?requestedDestination:(previous.stage===4&&s.location!=='太平洋'?s.location:'日本');
    if(!passive&&returnSea){next.stage=3;next.body='sea_creature';next.bodyAge=null;destination='太平洋';}
    else if(!passive&&/化形|变成人|恢复人形/.test(text)){next.stage=4;next.body='human';next.bodyAge=40;destination=shore;}
    else if(!passive&&/登岸|上岸|登陆|陆地/.test(text)){next.stage=4;next.body='amphibious';next.bodyAge=null;destination=shore;}
    else if(!passive&&requestedDestination&&previous.stage===4)destination=requestedDestination;
    else if(!passive&&/巨鲸|巨兽|海龙|神龙|巨龙|吞下.*(?:鲸|巨兽)/.test(text)){next.stage=Math.max(next.stage,3);next.body='sea_creature';}
    else if(previous.stage<4)next.body=['small_fish','predator','giant_fish','sea_creature'][next.stage];
    if(next.stage===4&&previous.stage<4){
      summary=next.body==='human'?`你沿洋流来到${destination}附近的海岸，集中注意力改变身体。吞食所得的力量使鳍与鳃逐渐发生变化，你在浅水里完成了人形转变，能够用双脚行走和呼吸空气。上岸后，你找到临时遮蔽的地方，开始处理衣食、身份和与人交流的问题。`:`你顺着海底坡地靠近${destination}海岸，身体长出能够支撑爬行的附肢，呼吸也逐渐适应空气。你在潮间带反复试着离开水面，成功进入岸边。海中的食物仍能维持体力，陆上的灯光和人群让你有了新的去处。`;
      delta={fitness:6,health:4,intelligence:2,stress:2};
    }else if(returnSea&&!passive){
      summary='你回到海水中，重新让身体适应游动和深水呼吸。留在岸上的经历没有消失，原有记忆与已经积累的力量仍然保留。你沿洋流返回太平洋，找到了能够补充食物的水域，开始按海中生物的方式生活。';
      delta={fitness:2,health:2,stress:-1};
    }else if(harvest){
      const bodyChange=next.stage>previous.stage?(next.stage===1?'鱼鳍和肌肉逐渐适应了更快的游动，你开始追踪更远处的鱼群。':next.stage===2?'身体长成深水中的大鱼，颌部与感官开始适应更大的猎物。':'身体已经能够承受深海的压力，你能察觉远处鱼群的位置。'):'你把找到食物的水域记在心里，沿附近的洋流继续活动。';
      summary=harvest.eaten?`你沿着鱼群游动，吃下了${harvest.eaten}条小鱼。${harvest.growth?'食物补充了体力，身体比出发时更大了一些。':'进食所得用于维持这次游动，体型没有明显增加。'}${bodyChange}`:'你在这片水域游动了一阵，没有捕到小鱼。你避开追不上的鱼群，回到能够休息的地方，身体保持出发时的大小，记下了这次经过的水域。';
      delta=harvest.growth?{fitness:Math.min(6,Math.ceil(harvest.growth/4)),health:Math.min(3,Math.ceil(harvest.growth/7)),stress:-1}:{stress:0};
    }else if(!passive&&!feeding&&/休息|躲|避开|停留/.test(text)){
      summary='你留在已经找到的遮蔽物旁休息，减少追逐与远距离游动，把体力留给必要的移动。附近出现大型鱼类时，你等它离开再调整位置，这次停留没有带来进食后的体型增长。';
      delta={health:1,stress:-2};
    }else if(next.stage>previous.stage){
      summary=`你${passive?'沿洋流寻找食物':'按自己的安排追踪猎物、选择能够接近的食物'}，在几次进食后出现新的身体变化。${next.stage===1?'鱼鳍能够支持更快的转向，原来必须躲开的鱼群进入了你的捕食范围。':next.stage===2?'体形长到足以穿过深水鱼群，肌肉和感官逐渐适应更大的猎物。':'体内的力量改变了骨骼和感官，你能够感到远处鱼群与洋流的位置，在深海长时间活动。'}你保留着过去的记忆，也开始熟悉这种身体的需要。`;
      delta={fitness:6,health:3,intelligence:1,stress:quality==='costly'?2:0};
    }else if(passive){
      summary='你随洋流觅食，避开食物稀少的水域，把得到的能量留在身体里。几次远处的震动让你调整了游动方向，这个月的活动范围比之前更清楚。';
      delta={fitness:1,health:1,stress:-1};
    }else{
      summary=`你开始实施“${tidyLocalProse(action.label).slice(0,160)}”。${next.stage<4?'你依靠鱼群、洋流与已经发生变化的身体完成这次行动，吞食得到的能量支持了移动与恢复。过程中找到的水域和感知方式留在记忆里，之后还能继续使用。':'你利用海中积累的力量和岸边找到的资源完成自己的安排。当地人的生活仍按原有秩序继续，你需要处理身体形态带来的实际反应。'}`;
      delta={fitness:2,intelligence:1,health:1,stress:quality==='costly'?3:1};
    }
  }
  // Keep existing transitions and numeric outcomes. Within an unchanged stage,
  // the completed month and its local scene describe the same new small event.
  if(passive&&next.stage===previous.stage)summary=quietScene({...s,turn:completedTurns(s)+1},next).summary;
  return {success:true,chance:1,quality,playerLed:!!action.custom,delta,summary:tidyLocalProse(summary),scope:'personal',worldDelta:{},destination,specialTransition:next,implementation:'special-body-continuity'};
}

export function advanceSpecialLife(s,result,action){
  if(!isSpecialLife(s))return;
  const previousBody=s.specialLife.body;
  if(result.specialTransition)s.specialLife=structuredClone(result.specialTransition);
  else{s.specialLife.monthsInBody++;s.specialLife.lastAction=action.passive?'按现有身体条件生活':tidyLocalProse(action.label).slice(0,500);}
  if(result.specialTransition&&(previousBody!=='human'||s.specialLife.body!=='human'||/恢复身体后重新生活|从海中化形后上岸/.test(s.person.occupation)))synchronizeSpecialIdentity(s);
  if(!action.passive&&result.success)s.person.facts=[...s.person.facts,`${date(s.month)}：${result.summary}`].slice(-40);
}

function synchronizeSpecialIdentity(s){
  const x=s.specialLife,mao=x.kind==='mao_resurrection';
  s.person.custody=false;
  s.person.occupation=mao?(x.stage>=3?'恢复身体后重新生活的毛泽东':x.stage===2?'接受照护的苏醒者':'水晶棺内意识苏醒的毛泽东'):(x.body==='human'?'从海中化形后上岸的邓小平':x.body==='amphibious'?'能够在岸上活动的海中生物':x.stage===0?'保有邓小平记忆的小鱼':x.stage===1?'保有邓小平记忆的捕食鱼':x.stage===2?'保有邓小平记忆的深海大鱼':'保有邓小平记忆的远洋生物');
  s.person.status=mao?(x.stage>=3?`身体已经恢复，保留过去记忆，正在了解${date(s.month)}的社会生活；没有自动获得现行国家职务`:x.stage===2?'身体正在恢复，可通过身边的照护人员沟通和办理事情':'仍在纪念堂水晶棺内，可以感知外部声音，通过细微反应寻求联系'):(x.stage>=4?`已经抵达${s.location}，保留海中的变化，按当前身体形态继续生活`:'生活在太平洋，靠游动、觅食与吞噬积累能量；没有人类工作、存款与日常住房');
}

export function specialLocalEvent(s,decision,action){
  if(!isSpecialLife(s))return null;
  const x=s.specialLife,mao=x.kind==='mao_resurrection';
  const opening=completedTurns(s)===0&&x.monthsInBody===0&&x.stage===0;
  // A restored human can acquire an ordinary new occupation through later actions.
  if(regularBody(s)&&!/恢复身体后重新生活|从海中化形后上岸/.test(s.person.occupation))return null;
  const descriptions=mao?[
    `隔着玻璃，你听见脚步和交谈声，意识到自己仍躺在纪念堂的水晶棺内。身体暂时不能自由活动，你记得自己的姓名，也听见值守人员谈到${date(s.month)}的新闻。你试着分辨周围的人，寻找能让他们确认你还有意识的办法。`,
    '工作人员发现了你反复出现的回应，开始轮流守在近处。他们给你读短句，让你用手指或视线作答。检查所得的记录已经送走，你可以向留在身边的人表达简单的要求，了解外面发生的事情。',
    '照护人员把检查与休息时间写在床边，你能够说出短句，也能在帮助下活动手臂。送来的报刊介绍了这些年的变化，你从熟悉的名字和陌生的制度安排中整理现在的处境。',
    '你已经能够独立行走，按自己的需要阅读、会面和休息。身边的人等待你说明接下来的打算，过去留下的名望使会面请求增加。现有机构有自己的负责人，你需要逐件安排此后的生活。',
    '公开会面之后，来信和采访请求陆续送来。有人希望核实你的身份，有人带着对现实生活的意见。你挑出愿意见的人，把会谈时间与身体恢复的安排放在一起考虑。'
  ]:[
    '你在太平洋的海水里醒来，身体是一条粉灰色的水滴鱼，皮肤没有鳞片，宽大的头部和柔软身体随海流移动，记忆里仍有邓小平的一生。附近的小型生物可以作为食物，大鱼经过时需要及时藏进暗处。你试着控制鱼鳍，寻找能靠近食物的位置。',
    '你能在鱼群中连续转向，捕食后积累的能量逐渐改变肌肉与感官。海流把食物带到新的水层，你记住几处可以停留的地方，按照自己的需要安排觅食、游动和休息。',
    '你的身体已经长成深水中的大鱼，小型鱼群会在接近时分散。更深处的食物能够带来新的变化，远处船只的声音也传入水中。你能够选择继续捕食、探索洋流，或向有陆地的方向移动。',
    '你在远洋活动，能够承受深水压力，也能感知较远处的鱼群。吞食留下的力量仍在改变身体，你记得海岸的方位，可以继续在海里生活，也可以尝试让自己的身体适应陆地。',
    x.body==='human'?`你住在${s.location}，已经能够以人形行走、交谈和进食。海里的经历仍留在记忆与身体中，住所、日用品和人际往来需要重新安排。当地的消息通过路边商店与人们的交谈进入你的生活。`:`你能在${s.location}的岸边爬行和呼吸，仍需要海中的食物补充体力。岸边的灯光、道路与住户都已看得清楚，路人会对你的形态作出反应。你可以留在潮间带，也可以继续改变身体。`
  ];
  if(!opening){
    descriptions[0]=mao?'你仍在纪念堂的水晶棺内，继续辨认值守人员的声音，按照已经试过的方法活动手指和眼睛。身体暂时不能自由活动，外界的交谈让你知道日期与身边的安排。你记住能够传达回应的时机，继续寻找与照护人员沟通的办法。':'你继续在太平洋这片熟悉的水域活动，仍是一条靠鳍游动的小鱼，保留着邓小平的记忆。你沿之前经过的洋流寻找食物，大鱼靠近时就向遮蔽物游去。已有的体力和身体变化保留下来，你按鱼群的位置安排觅食与休息。';
    if(mao)descriptions[1]='值守人员按照已有记录轮流照看你，用短句询问近况，让你通过手指和视线作答。你沿用已经能够表达的回应方式，说明自己的要求，听取送来的消息。检查与交流继续进行，先前确认的身体反应和约定都留在记录里。';
  }
  const variations=mao?['你留意每次接触中能确认的细节，记下已经答复的请求。','身边的人按约定时间送来资料，你从现有信息里安排后续事情。','新的检查记录已经放好，你根据身体情况调整活动时间。']:['你记住本月发现的食物与停留地点，为下一次移动保留体力。','水温和食物分布有所变化，你调整了活动范围。','你逐渐掌握身体的新反应，减少了几次没有必要的消耗。'];
  const quiet=!opening&&action?.passive?quietScene(s):null;
  const title=quiet?.title||stages[x.kind][x.stage];
  const labels=mao?(x.stage<3?['尝试让值守人员确认自己的意识','配合照护，逐渐恢复身体','请身边的人介绍现在的情况','集中精神复活，站起来说话']:['了解如今的社会与普通人的生活','与愿意见面的人讨论自己的打算','公开接受采访，说明自己的近况','休息并记录已经发生的事情']):(x.stage<4?['寻找合适的猎物，吞噬后继续进化','沿洋流探索新的水域','躲进安全的水域休息','向日本海岸游去，尝试上岸']:['回海里觅食，保留目前的身体','让身体化形，成为能够在人群中生活的人','观察附近居民的生活','沿海岸寻找能够停留的地方']);
  const body=quiet?.narrative||(opening?descriptions[0]:`${descriptions[x.stage]} ${variations[modulo(s.month,variations.length)]}`);
  const event={title,narrative:tidyLocalProse(body),consequence:tidyLocalProse(s.actionResult?.summary||''),options:decision?labels.map(label=>({label,description:'按照自己的身体情况和意愿安排这个月。',delta:{},check:{stat:'intelligence',difficulty:35}})):[],memory:action?.custom?`${title}：${x.lastAction}`:'',actionDelta:{},location:s.location,dailyId:quiet?.id||`special_${x.kind}_${x.stage}_${modulo(s.month,3)}`,dailyCategory:mao?(x.stage<3?'health':'relationships'):x.stage<4?'exploration':'leisure',decision,news:s.pendingNews||[],source:'local'};
  return opening?event:continuityNarrative(s,action,s.actionResult,event);
}

export function specialPromptContext(s){
  if(!isSpecialLife(s))return null;
  const x=s.specialLife;
  return {...x,stageName:stages[x.kind][x.stage],chronologicalAgeIsNotBodyAge:true,
    instruction:x.kind==='mao_resurrection'?'这是明确指定的复活经历。stage小于3时身体仍处于棺内或照护恢复中；不能写成普通退休老人已在家中散步。stage达到3后复活已实际完成，后续不得退回仅有意识或无法活动。stage小于4且没有明确公开行动时，只描写既有值守、照护与联络人员的反应，不让全社会提前知情。原有名望不自动授予现行国家职务。同阶段的被动月份采用本月新场景，不反复重演苏醒和同一项检查。':'这是明确指定的魔幻海洋经历，允许吞噬进化、感官变化、化形与登陆。初始身体是粉灰色、皮肤无鳞片的水滴鱼，宽头、小眼、嘴向下，按已发生的形态变化继续描写。lastFishGame是最近一次实际捕获记录，不可当作每月重复捕获；本次没有吃到鱼或仅休息就不能宣称大量成长。被动月份采用本月新场景，可以遇到水流、地形、生物活动的变化，不凭空追加捕获数、身体能力或成长。按body描写真实发生的活动，不能改成梦、比喻、精神疾病或普通退休生活。仍在海里时没有人类工作、房租、购物与陆上住处；登陆之后按当前所在地与身体状态写。'};
}
